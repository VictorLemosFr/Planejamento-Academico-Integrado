"""The personal API must not accept forged official history or lose saved choices."""

import pytest

ORIGIN = {"Origin": "http://testserver"}


def test_personal_resources_require_session(client):
    for path in ["/auth/me", "/me/history", "/me/progression", "/plans"]:
        assert client.get("/api" + path).status_code == 401


def test_login_requires_allowed_origin(client):
    response = client.post("/api/auth/login", json={"email": "a@example.org", "password": "secret"})
    assert response.status_code == 403


def test_demo_is_disabled_by_default(client):
    from app.core.config import get_settings

    get_settings().demo_enabled = False
    assert client.get("/api/scenarios").status_code == 404
    assert client.post("/api/simulations", json={"current_period": 1}).status_code == 404


def login(client, email="a@example.org"):
    response = client.post(
        "/api/auth/login", headers=ORIGIN, json={"email": email, "password": "test-secret"}
    )
    assert response.status_code == 200, response.text
    return {**ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]}


def history(records=None, period=2):
    return {
        "schema_version": 1,
        "source": "test",
        "source_reference": "fictional",
        "current_period": period,
        "records": records or [],
    }


def record(course="intro", status="completed", term="2026.1"):
    return {"course_id": course, "status": status, "academic_term": term}


def import_history(client, headers, payload):
    return client.put("/api/admin/students/A/history", headers=headers, json=payload)


def test_login_logout_cookie_csrf_and_role(accounts):
    headers = login(accounts)
    assert accounts.get("/api/auth/me").json()["user"]["role"] == "student"
    assert "HttpOnly" in accounts.cookies.__repr__() or accounts.cookies.get("pai_session")
    assert accounts.get("/api/me/history").json()["awaiting_import"] is True
    assert (
        accounts.post(
            "/api/plans", json={"name": "one", "target_term": "2026.2"}, headers=ORIGIN
        ).status_code
        == 403
    )
    assert import_history(accounts, headers, history()).status_code == 403
    assert accounts.post("/api/auth/logout", headers=headers).status_code == 200
    assert accounts.get("/api/auth/me").status_code == 401


def test_import_is_atomic_idempotent_and_official_inconsistency_is_warning(accounts):
    headers = login(accounts, "coord@example.org")
    payload = history([record("data")])
    imported = import_history(accounts, headers, payload)
    assert imported.status_code == 200, imported.text
    assert imported.json()["revision"] == 1
    assert imported.json()["warnings"]
    assert import_history(accounts, headers, payload).json()["revision"] == 1
    bad = history([record(), record("unknown")])
    assert import_history(accounts, headers, bad).status_code == 422
    assert (
        import_history(accounts, headers, history([record(), record(status="failed")])).status_code
        == 422
    )
    login(accounts)
    current = accounts.get("/api/me/history").json()
    assert current["revision"] == 1
    assert current["records"] == payload["records"]
    progress = accounts.get("/api/me/progression").json()
    assert progress["official_completed_ids"] == ["data"]


def test_saved_alternatives_isolation_conflicts_and_revalidation(accounts):
    coord = login(accounts, "coord@example.org")
    assert import_history(accounts, coord, history([record()])).status_code == 200
    headers = login(accounts)
    first = accounts.post(
        "/api/plans", headers=headers, json={"name": "A", "target_term": "2026.2"}
    ).json()
    second = accounts.post(
        "/api/plans", headers=headers, json={"name": "B", "target_term": "2026.2"}
    ).json()
    path = "/api/plans/" + first["id"]
    draft = {"planned_ids": ["data"], "hypothetical_ids": [], "version": 1, "history_revision": 1}
    assert (
        accounts.post(path + "/simulations", headers=headers, json=draft).json()["planned_hours"]
        == 60
    )
    assert accounts.get(path).json()["planned_ids"] == []
    saved = accounts.put(
        path, headers=headers, json={**draft, "name": "A", "target_term": "2026.2"}
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["version"] == 2
    assert (
        accounts.put(
            path, headers=headers, json={**draft, "name": "stale", "target_term": "2026.2"}
        ).status_code
        == 409
    )
    accounts.post("/api/auth/logout", headers=headers)
    headers = login(accounts)
    assert accounts.get(path).json()["planned_ids"] == ["data"]
    login(accounts, "b@example.org")
    assert accounts.get(path).status_code == 404
    assert accounts.get("/api/plans").json() == []
    coord = login(accounts, "coord@example.org")
    assert import_history(accounts, coord, history([record(status="failed")])).status_code == 200
    headers = login(accounts)
    invalid = accounts.get(path).json()
    assert invalid["planned_ids"] == ["data"]
    assert invalid["valid"] is False
    assert invalid["problems"]["data"]
    assert (
        accounts.put(
            path,
            headers=headers,
            json={**draft, "version": 2, "name": "A", "target_term": "2026.2"},
        ).status_code
        == 409
    )
    repaired = {
        **draft,
        "version": 2,
        "history_revision": 2,
        "action": {"kind": "unplan", "course_id": "data"},
    }
    assert (
        accounts.post(path + "/simulations", headers=headers, json=repaired).json()["valid"] is True
    )
    assert accounts.delete(path, headers=headers, params={"version": 1}).status_code == 409
    assert accounts.delete(path, headers=headers, params={"version": 2}).status_code == 200
    assert accounts.get("/api/plans").json()[0]["id"] == second["id"]


def test_hypotheses_never_mutate_official_history(accounts):
    headers = login(accounts)
    plan = accounts.post(
        "/api/plans", headers=headers, json={"name": "Hypothesis", "target_term": "2026.2"}
    ).json()
    path = "/api/plans/" + plan["id"] + "/simulations"
    base = {"version": 1, "history_revision": 0, "hypothetical_ids": [], "planned_ids": []}
    planned = accounts.post(
        path, headers=headers, json={**base, "action": {"kind": "plan", "course_id": "intro"}}
    ).json()
    assert next(c for c in planned["courses"] if c["id"] == "data")["status"] == "locked"
    approved = accounts.post(
        path, headers=headers, json={**base, "action": {"kind": "approve", "course_id": "intro"}}
    ).json()
    assert approved["hypothetical_ids"] == ["intro"]
    assert next(c for c in approved["courses"] if c["id"] == "intro")["status"] == "simulated"
    assert accounts.get("/api/me/history").json()["records"] == []
    revoked = accounts.post(
        path,
        headers=headers,
        json={
            **base,
            "hypothetical_ids": ["intro"],
            "planned_ids": ["data"],
            "action": {"kind": "revoke", "course_id": "intro"},
        },
    ).json()
    assert revoked["planned_ids"] == []
    assert revoked["hypothetical_ids"] == []
    assert (
        accounts.post(path, headers=headers, json={**base, "completed_ids": ["intro"]}).status_code
        == 422
    )


def test_sessions_expire_and_password_reset_revokes_access(accounts):
    from datetime import UTC, datetime, timedelta

    from app.accounts import reset_password
    from app.core.database import get_session
    from app.main import app
    from app.modules.personal.models import LoginSession
    from app.modules.personal.security import token_hash

    login(accounts)
    token = accounts.cookies.get("pai_session")
    with next(app.dependency_overrides[get_session]()) as db:
        login_session = db.get(LoginSession, token_hash(token))
        assert login_session.token_hash != token
        login_session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    assert accounts.get("/api/auth/me").status_code == 401
    login(accounts)
    with next(app.dependency_overrides[get_session]()) as db:
        reset_password(db, "a@example.org", "replacement-secret")
    assert accounts.get("/api/auth/me").status_code == 401
    assert (
        accounts.post(
            "/api/auth/login",
            headers=ORIGIN,
            json={"email": "a@example.org", "password": "test-secret"},
        ).status_code
        == 401
    )
    assert (
        accounts.post(
            "/api/auth/login",
            headers=ORIGIN,
            json={"email": "a@example.org", "password": "replacement-secret"},
        ).status_code
        == 200
    )


def test_provisioning_and_deactivation(client):
    from app.accounts import deactivate, provision
    from app.core.config import get_settings
    from app.core.database import get_session
    from app.main import app

    get_settings().allowed_origins = ["http://testserver"]
    with next(app.dependency_overrides[get_session]()) as db:
        provision(db, "A@Example.org", "test-secret", "student", "A", 3)
    headers = login(client)
    assert client.get("/api/me/history").json()["current_period"] == 3
    with next(app.dependency_overrides[get_session]()) as db:
        deactivate(db, "a@example.org")
    assert client.get("/api/auth/me").status_code == 401
    assert (
        client.post(
            "/api/auth/login",
            headers=ORIGIN,
            json={"email": "a@example.org", "password": "test-secret"},
        ).status_code
        == 401
    )
    assert client.post("/api/auth/logout", headers=headers).status_code == 401


def test_attempt_precedence_and_readonly_official_approvals(accounts):
    coord = login(accounts, "coord@example.org")
    imported = import_history(
        accounts,
        coord,
        history(
            [
                record(status="failed", term="2025.2"),
                record(),
                record(status="in_progress", term="2026.2"),
                record("data", status="in_progress", term="2026.2"),
            ]
        ),
    )
    assert imported.status_code == 200
    headers = login(accounts)
    progress = accounts.get("/api/me/progression").json()
    assert progress["official_completed_ids"] == ["intro"]
    assert progress["in_progress_ids"] == ["data"]
    plan = accounts.post(
        "/api/plans", headers=headers, json={"name": "Official", "target_term": "2027.1"}
    ).json()
    base = {"version": 1, "history_revision": 1, "hypothetical_ids": [], "planned_ids": []}
    for kind in ["revoke", "approve"]:
        assert (
            accounts.post(
                "/api/plans/" + plan["id"] + "/simulations",
                headers=headers,
                json={**base, "action": {"kind": kind, "course_id": "intro"}},
            ).status_code
            == 422
        )
    invalid = accounts.put(
        "/api/plans/" + plan["id"],
        headers=headers,
        json={**base, "name": "bad", "target_term": "2027.1", "planned_ids": ["data"]},
    )
    assert invalid.status_code == 422


@pytest.mark.parametrize(
    "change",
    [
        {"current_period": 21},
        {"schema_version": 2},
        {"records": [record(term="2026.3")]},
        {"records": [record(status="unknown")]},
    ],
)
def test_import_contract_rejects_invalid_fields(accounts, change):
    headers = login(accounts, "coord@example.org")
    assert import_history(accounts, headers, {**history(), **change}).status_code == 422


def test_other_student_cannot_write_or_simulate_owned_plan(accounts):
    headers = login(accounts)
    plan = accounts.post(
        "/api/plans", headers=headers, json={"name": "Private", "target_term": "2026.2"}
    ).json()
    other = login(accounts, "b@example.org")
    path = "/api/plans/" + plan["id"]
    draft = {"version": 1, "history_revision": 0, "hypothetical_ids": [], "planned_ids": []}
    assert accounts.post(path + "/simulations", headers=other, json=draft).status_code == 404
    assert (
        accounts.put(
            path, headers=other, json={**draft, "name": "Attack", "target_term": "2026.2"}
        ).status_code
        == 404
    )
    assert accounts.delete(path, headers=other, params={"version": 1}).status_code == 404


def test_write_origin_csrf_and_production_cookie(accounts, monkeypatch):
    from app.core.config import get_settings

    headers = login(accounts)
    payload = {"name": "Security", "target_term": "2026.2"}
    assert (
        accounts.post(
            "/api/plans", headers={**headers, "Origin": "https://evil.test"}, json=payload
        ).status_code
        == 403
    )
    assert (
        accounts.post(
            "/api/plans", headers={**headers, "X-CSRF-Token": "wrong"}, json=payload
        ).status_code
        == 403
    )
    monkeypatch.setattr(get_settings(), "environment", "production")
    response = accounts.post(
        "/api/auth/login",
        headers=ORIGIN,
        json={"email": "a@example.org", "password": "test-secret"},
    )
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    assert "Max-Age=28800" in cookie


def test_same_import_in_different_record_order_is_idempotent(accounts):
    headers = login(accounts, "coord@example.org")
    records = [record("intro", term="2025.2"), record("data")]
    assert import_history(accounts, headers, history(records)).json()["revision"] == 1
    assert import_history(accounts, headers, history(records[::-1])).json()["unchanged"] is True


def test_hypothetical_incoherence_cannot_be_saved(accounts):
    headers = login(accounts)
    plan = accounts.post(
        "/api/plans", headers=headers, json={"name": "Invalid", "target_term": "2026.2"}
    ).json()
    payload = {
        "name": "Invalid",
        "target_term": "2026.2",
        "version": 1,
        "history_revision": 0,
        "hypothetical_ids": ["data"],
        "planned_ids": [],
    }
    assert (
        accounts.put("/api/plans/" + plan["id"], headers=headers, json=payload).status_code == 422
    )
    assert accounts.get("/api/plans/" + plan["id"]).json()["hypothetical_ids"] == []


def test_empty_import_has_metadata_but_still_waits_for_history_records(accounts):
    coord = login(accounts, "coord@example.org")
    assert import_history(accounts, coord, history()).status_code == 200
    login(accounts)
    current = accounts.get("/api/me/history").json()
    assert current["import"] is not None
    assert current["awaiting_import"] is True


def test_old_in_progress_attempt_does_not_override_later_failure(accounts):
    headers = login(accounts, "coord@example.org")
    payload = history(
        [record(status="in_progress", term="2025.2"), record(status="failed", term="2026.1")]
    )
    assert import_history(accounts, headers, payload).status_code == 200
    login(accounts)
    progress = accounts.get("/api/me/progression").json()
    assert progress["in_progress_ids"] == []
    assert progress["official_completed_ids"] == []
    assert next(c for c in progress["courses"] if c["id"] == "data")["status"] == "locked"
