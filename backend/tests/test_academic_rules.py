"""Notas, reprovações (Res. nº 09/2009-CCEPE) e CR ponderado por créditos."""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, event, text

from alembic import command
from app.modules.personal.service import evaluate
from app.modules.progression.rules import coefficient, failure_level

ORIGIN = {"Origin": "http://testserver"}
COURSES = {
    "a": {"id": "a", "hours": 120, "credits": 5},
    "b": {"id": "b", "hours": 60, "credits": 4},
    "c": {"id": "c", "hours": 60, "credits": None},
}


def test_failure_levels_follow_the_resolution():
    assert [failure_level(n) for n in range(5)] == [
        None,
        "attention",
        "critical",
        "refused",
        "refused",
    ]


def test_cr_and_mc_weight_every_graded_attempt_by_hours():
    records = [
        {"course_id": "a", "status": "failed", "grade": 0.0},
        {"course_id": "a", "status": "completed", "grade": 8.0},
        {"course_id": "b", "status": "completed", "grade": 10.0},
        {"course_id": "c", "status": "completed"},
        {"course_id": "b", "status": "in_progress"},
    ]
    cr = coefficient(records, COURSES)
    # Como o SIGAA: peso = carga horária. (120*0 + 120*8 + 60*10) / 300
    assert cr["value"] == round(1560 / 300, 4)
    # MC: só aprovações. (120*8 + 60*10) / 180
    assert cr["mc"] == round(1560 / 180, 4)
    assert cr["hours"] == 300 and cr["graded_attempts"] == 3 and cr["ungraded_attempts"] == 1
    simulated = coefficient(records, COURSES, {"c": 10.0})
    assert simulated["simulated_value"] == round(2160 / 360, 4)


def test_cr_follows_sigaa_hour_weighting():
    # Dados fictícios. Ponderar pela CH (como o SIGAA) e não pelos créditos muda o
    # resultado quando a mesma carga tem créditos diferentes.
    by_id = {
        "a": {"id": "a", "hours": 60, "credits": 4},
        "b": {"id": "b", "hours": 120, "credits": 5},
        "c": {"id": "c", "hours": 60, "credits": 3},
        "d": {"id": "d", "hours": 60, "credits": 4},
    }
    records = [
        {"course_id": "a", "status": "completed", "grade": 9.0},
        {"course_id": "b", "status": "completed", "grade": 6.5},
        {"course_id": "c", "status": "completed", "grade": 8.0},
        {"course_id": "d", "status": "failed", "grade": 2.0},
    ]
    cr = coefficient(records, by_id)
    # (60·9 + 120·6,5 + 60·8 + 60·2) / 300 e, só aprovações, / 240.
    assert cr["value"] == 6.4
    assert cr["mc"] == 7.5


def signup(client, program="SI", term="2024.1", period=4):
    from app.core.database import get_session
    from app.main import app
    from app.seed import seed

    with next(app.dependency_overrides[get_session]()) as session:
        seed(session)
    response = client.post(
        "/api/auth/register",
        headers=ORIGIN,
        json={
            "email": f"{uuid4().hex[:8]}@example.org",
            "password": "long-secret",
            "registration": uuid4().hex[:10],
            "current_period": period,
            "start_term": term,
            "program": program,
        },
    )
    assert response.status_code == 201, response.text
    return {**ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]}


def attempts(*items):
    return [
        {"course_id": course, "academic_term": term, "status": status}
        | ({"grade": grade} if grade is not None else {})
        for course, term, status, grade in items
    ]


def test_three_failures_refuse_enrollment_and_block_planning(client):
    headers = signup(client)
    history = attempts(
        ("ip", "2024.1", "failed", 3.0),
        ("ip", "2024.2", "failed", 0.0),
        ("ip", "2025.1", "failed", 4.5),
        ("mdc", "2024.1", "completed", 9.0),
    )
    payload = {"start_term": "2024.1", "current_period": 4, "records": history}
    assert client.put("/api/me/history", headers=headers, json=payload).status_code == 200
    progression = client.get("/api/me/progression").json()
    ip = next(c for c in progression["courses"] if c["id"] == "ip")
    assert ip["failures"] == 3 and ip["failure_level"] == "refused"
    assert [a["grade"] for a in ip["attempts"]] == [3.0, 0.0, 4.5]
    # (120*3 + 120*0 + 120*4.5 + 60*9) / 420
    assert progression["cr"]["value"] == round(1440 / 420, 4)

    fourth = attempts(("ip", "2025.2", "completed", 7.0))
    blocked = client.put(
        "/api/me/history",
        headers=headers,
        json={**payload, "records": history + fourth},
    )
    assert blocked.status_code == 422 and "recusada" in blocked.json()["detail"]

    plan = client.post(
        "/api/plans", headers=headers, json={"name": "P", "target_term": "2025.2"}
    ).json()
    refused = client.post(
        f"/api/plans/{plan['id']}/simulations",
        headers=headers,
        json={
            "version": plan["version"],
            "history_revision": plan["history_revision"],
            "action": {"kind": "approve", "course_id": "ip"},
        },
    )
    assert refused.status_code == 422 and "recusada" in refused.json()["detail"]


def test_simulated_grades_are_saved_with_the_plan(client):
    headers = signup(client, period=2)
    payload = {
        "start_term": "2024.1",
        "current_period": 2,
        "records": attempts(("ip", "2024.1", "completed", 6.0)),
    }
    client.put("/api/me/history", headers=headers, json=payload)
    plan = client.post(
        "/api/plans", headers=headers, json={"name": "P", "target_term": "2024.2"}
    ).json()
    saved = client.put(
        f"/api/plans/{plan['id']}",
        headers=headers,
        json={
            "name": "P",
            "target_term": "2024.2",
            "version": plan["version"],
            "history_revision": plan["history_revision"],
            "planned_ids": ["ds"],
            "hypothetical_ids": [],
            "simulated_grades": {"ds": 10, "algo": 9},
        },
    ).json()
    # Só vale nota simulada de disciplina planejada ou aprovada na hipótese.
    assert saved["simulated_grades"] == {"ds": 10.0}
    assert saved["cr"]["value"] == 6.0
    # (120*6 + 120*10) / 240: IP e Desenvolvimento de Software têm 120h.
    assert saved["cr"]["simulated_value"] == 8.0
    assert client.get(f"/api/plans/{plan['id']}").json()["simulated_grades"] == {"ds": 10.0}


def test_in_progress_attempt_cannot_have_a_grade(client):
    headers = signup(client, period=2)
    response = client.put(
        "/api/me/history",
        headers=headers,
        json={
            "start_term": "2024.1",
            "current_period": 2,
            "records": attempts(("ip", "2024.2", "in_progress", 5.0)),
        },
    )
    assert response.status_code == 422


def test_evaluate_exposes_attempts_without_history_grades():
    courses = [
        {
            "id": "x",
            "name": "X",
            "short_name": "X",
            "hours": 60,
            "credits": 4,
            "period": 1,
            "type": "mandatory",
            "prerequisite_ids": [],
        }
    ]
    history = {
        "revision": 1,
        "awaiting_import": False,
        "current_period": 2,
        "records": attempts(("x", "2025.1", "failed", None)),
    }
    result = evaluate(courses, history)
    assert result["courses"][0]["failure_level"] == "attention"
    assert result["cr"]["value"] is None and result["cr"]["ungraded_attempts"] == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="TEST_DATABASE_URL is required for real PostgreSQL",
)
def test_0010_adds_credits_without_overwriting():
    url = os.environ["TEST_DATABASE_URL"]
    schema = "test_0010_" + uuid4().hex
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url)

    @event.listens_for(engine, "connect")
    def search_path(dbapi_connection, _):
        dbapi_connection.autocommit = True
        dbapi_connection.execute(f'SET search_path TO "{schema}"')
        dbapi_connection.autocommit = False

    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    try:
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "0009")
            connection.execute(
                text(
                    "INSERT INTO courses (id, curriculum_id, name, short_name, hours, period, type)"
                    " VALUES ('ip', 'SI-2024', 'IP', 'IP', 120, 1, 'mandatory')"
                )
            )
            command.upgrade(config, "head")
            assert connection.execute(text("SELECT credits FROM courses")).scalar() == 5
            assert connection.execute(text("SELECT simulated_grades FROM plans")).first() is None
            command.downgrade(config, "0009")
            command.upgrade(config, "head")
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def test_preview_evaluates_without_saving(client):
    headers = signup(client, period=2)
    draft = {
        "start_term": "2024.1",
        "current_period": 2,
        "records": attempts(("ip", "2024.1", "completed", 8.0), ("cad", "2024.1", "failed", 2.0)),
    }
    preview = client.post("/api/me/history/preview", headers=headers, json=draft).json()
    status = {c["id"]: c["status"] for c in preview["courses"]}
    assert status["ip"] == "completed" and status["ds"] == "available"
    assert preview["cr"]["value"] == round((120 * 8 + 60 * 2) / 180, 4)
    assert client.get("/api/me/history").json()["revision"] == 0
    four = attempts(*[("cad", f"202{i}.1", "failed", 1.0) for i in range(4, 8)])
    rejected = client.post(
        "/api/me/history/preview", headers=headers, json={**draft, "records": four}
    )
    assert rejected.status_code == 422
