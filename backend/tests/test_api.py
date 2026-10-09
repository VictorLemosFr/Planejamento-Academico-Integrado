import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_session
from app.main import app
from app.modules.curriculum.models import Course, Prerequisite


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all(
            [
                Course(
                    id="intro",
                    name="Introdução",
                    short_name="Introdução",
                    hours=60,
                    period=1,
                    type="mandatory",
                ),
                Course(
                    id="data",
                    name="Estruturas",
                    short_name="Estruturas",
                    hours=60,
                    period=2,
                    type="mandatory",
                ),
            ]
        )
        session.flush()
        session.add(Prerequisite(course_id="data", prerequisite_id="intro"))
        session.commit()

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_catalog_returns_persisted_prerequisites(client):
    response = client.get("/api/curriculum")
    assert response.status_code == 200
    courses = {c["id"]: c for c in response.json()}
    assert courses["data"]["prerequisite_ids"] == ["intro"]
    assert courses["intro"]["hours"] == 60


def test_simulation_uses_database_rules_and_does_not_mutate_catalog(client):
    response = client.post(
        "/api/simulations",
        json={
            "current_period": 2,
            "completed_ids": [],
            "planned_ids": [],
            "action": {"kind": "approve", "course_id": "intro"},
        },
    )
    assert response.status_code == 200
    assert response.json()["completed_ids"] == ["intro"]
    assert response.json()["counts"]["available"] == 1
    untouched = client.post("/api/simulations", json={"current_period": 2})
    assert untouched.json()["completed_ids"] == []
    assert untouched.json()["counts"]["locked"] == 1


@pytest.mark.parametrize(
    "payload",
    [
        {"current_period": 0},
        {"current_period": 2, "completed_ids": ["missing"]},
        {"current_period": 2, "action": {"kind": "approve", "course_id": "data"}},
        {"current_period": 2, "action": {"kind": "invalid", "course_id": "intro"}},
        {"current_period": 2, "planned_ids": ["intro"], "completed_ids": ["intro"]},
    ],
)
def test_api_rejects_invalid_simulations(client, payload):
    assert client.post("/api/simulations", json=payload).status_code == 422


def test_database_unavailable_returns_actionable_error(client):
    def unavailable():
        from sqlalchemy.exc import OperationalError

        raise OperationalError("select", {}, Exception("offline"))
        yield

    app.dependency_overrides[get_session] = unavailable
    response = client.get("/api/curriculum")
    assert response.status_code == 503
    assert "banco" in response.json()["detail"].lower()
