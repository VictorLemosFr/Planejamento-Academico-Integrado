import pytest

from app.core.database import get_session
from app.main import app


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
