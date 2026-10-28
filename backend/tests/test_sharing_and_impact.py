"""Link somente leitura de um plano e a pergunta "e se eu reprovar?"."""

from test_academic_rules import ORIGIN, attempts, signup


def test_shared_link_hides_grades_identity_and_can_be_revoked(client):
    headers = signup(client, period=3)
    history = client.put(
        "/api/me/history",
        headers=headers,
        json={
            "start_term": "2024.1",
            "current_period": 3,
            "records": attempts(
                ("ip", "2024.1", "failed", 3.0), ("ip", "2024.2", "completed", 9.5)
            ),
        },
    )
    assert history.status_code == 200, history.text
    plan = client.post(
        "/api/plans", headers=headers, json={"name": "Plano A", "target_term": "2025.2"}
    ).json()
    assert plan["share_token"] is None

    token = client.post(f"/api/plans/{plan['id']}/share", headers=headers).json()["token"]
    # Compartilhar de novo devolve o mesmo link.
    again = client.post(f"/api/plans/{plan['id']}/share", headers=headers).json()
    assert again["token"] == token
    assert client.get(f"/api/plans/{plan['id']}").json()["share_token"] == token

    shared = client.get(f"/api/public/shared/{token}")
    assert shared.status_code == 200
    body = shared.json()
    assert body["name"] == "Plano A" and body["curriculum"]["program"] == "SI"
    text = shared.text
    for private in ["cr", "email", "registration", "history_revision", "simulated_grades"]:
        assert f'"{private}"' not in text
    ip = next(c for c in body["courses"] if c["id"] == "ip")
    assert ip["status"] == "completed"
    assert ip["grade"] is None and ip["failures"] == 0 and ip["attempts"] == []

    # Sem login, o link continua funcionando; nada além dele é exposto.
    client.cookies.clear()
    assert client.get(f"/api/public/shared/{token}").status_code == 200
    assert client.get("/api/public/shared/" + "x" * 32).status_code == 404
    assert client.get("/api/public/shared/curto").status_code == 404


def test_revoked_link_stops_working(client):
    headers = signup(client, period=1)
    plan = client.post(
        "/api/plans", headers=headers, json={"name": "B", "target_term": "2024.2"}
    ).json()
    token = client.post(f"/api/plans/{plan['id']}/share", headers=headers).json()["token"]
    assert client.delete(f"/api/plans/{plan['id']}/share", headers=headers).status_code == 200
    assert client.get(f"/api/public/shared/{token}").status_code == 404
    # Mudanças exigem a origem e o token CSRF da sessão.
    assert client.post(f"/api/plans/{plan['id']}/share", headers=ORIGIN).status_code == 403


def test_failure_impact_endpoint(client):
    headers = signup(client, period=1)
    impact = client.get("/api/me/progression/failure-impact/ip", headers=headers)
    assert impact.status_code == 200, impact.text
    body = impact.json()
    assert body["applicable"] and body["failures_after"] == 1
    assert body["failure_level_after"] == "attention"
    assert body["blocked_ids"]
    assert body["after"]["estimated_semesters"] >= body["before"]["estimated_semesters"]
    assert client.get("/api/me/progression/failure-impact/nada").status_code == 404
