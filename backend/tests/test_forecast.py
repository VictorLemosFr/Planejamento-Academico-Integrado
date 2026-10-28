import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_session
from app.main import app
from app.modules.curriculum.catalog import CATALOGS
from app.modules.curriculum.repository import list_courses
from app.modules.personal.service import evaluate
from app.modules.planning.forecast import current_term, longest_chain, summarize, term_after
from app.seed import seed

SI = next(catalog for catalog in CATALOGS if catalog["id"] == "SI-2024")


def course(course_id, prerequisites=(), hours=60, period=1, kind="mandatory"):
    return {
        "id": course_id,
        "name": course_id,
        "short_name": course_id,
        "hours": hours,
        "period": period if kind == "mandatory" else None,
        "type": kind,
        "prerequisite_ids": list(prerequisites),
        "prerequisite_status": "verified",
    }


def history(current_period=1, start_term="2025.1", records=()):
    return {
        "revision": 1,
        "awaiting_import": not records,
        "current_period": current_period,
        "start_term": start_term,
        "records": list(records),
    }


@pytest.mark.parametrize(
    "term,steps,expected",
    [
        ("2025.1", 0, "2025.1"),
        ("2025.1", 1, "2025.2"),
        ("2025.2", 1, "2026.1"),
        ("2025.1", 4, "2027.1"),
    ],
)
def test_term_arithmetic(term, steps, expected):
    assert term_after(term, steps) == expected


def test_current_term_counts_from_entry():
    assert current_term("2025.1", 1) == "2025.1"
    assert current_term("2025.1", 3) == "2026.1"
    assert current_term(None, 3) is None


def test_longest_chain_ignores_completed_links():
    courses = [course("a"), course("b", ["a"]), course("c", ["b"]), course("d")]
    assert longest_chain(courses, {"a", "b", "c", "d"}) == ["a", "b", "c"]
    assert longest_chain(courses, {"b", "c", "d"}) == ["b", "c"]
    assert longest_chain(courses, set()) == []


def test_forecast_uses_the_larger_of_chain_and_pace():
    courses = [
        course("a", hours=120),
        course("b", ["a"]),
        course("c", ["b"]),
        course("e", kind="elective"),
    ]
    requirements = {"profile_elective_hours": 120, "standard_semesters": 4}
    # Ritmo da grade: (240 obrigatórias + 120 eletivas) / 4 = 90h por semestre.
    integralization, forecast = summarize(courses, set(), set(), requirements, history())
    assert integralization["mandatory"] == {
        "required": 240,
        "completed": 0,
        "in_progress": 0,
        "official_required": None,
    }
    assert forecast["critical_path_ids"] == ["a", "b", "c"]
    assert forecast["pace_hours_per_semester"] == 90
    assert forecast["load_semesters"] == 4
    assert forecast["estimated_semesters"] == 4
    assert forecast["estimated_completion_term"] == "2027.1"

    _, after = summarize(courses, {"a", "e"}, {"b"}, requirements, history(3))
    assert after["critical_path_ids"] == ["c"]
    assert after["remaining_profile_elective_hours"] == 60
    assert after["load_semesters"] == 2
    assert after["earliest_completion_term"] == "2026.2"


def test_unverified_prerequisites_are_flagged():
    courses = [course("a") | {"prerequisite_status": "unverified"}]
    _, forecast = summarize(courses, set(), set(), {}, history(start_term=None))
    assert not forecast["prerequisites_verified"]
    assert "não estão confirmados" in forecast["assumptions"][0]
    assert forecast["estimated_completion_term"] is None


def test_si_fresh_student_needs_the_standard_duration():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session)
        courses = list_courses(session, "SI-2024")
    engine.dispose()
    result = evaluate(courses, history(), requirements=SI)
    assert result["integralization"]["mandatory"]["required"] == SI["official_mandatory_hours"]
    assert result["integralization"]["profile_electives"]["required"] == 600
    assert result["forecast"]["estimated_semesters"] == SI["standard_semesters"]
    assert result["forecast"]["critical_path_semesters"] >= 2


@pytest.fixture
def public_client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session)

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    engine.dispose()


def test_public_catalog_lists_every_program(public_client):
    listing = public_client.get("/api/public/curricula").json()
    assert {item["program"] for item in listing} == {"CC", "SI", "IA", "EC"}
    si = next(item for item in listing if item["id"] == "SI-2024")
    assert si["course_count"] == 56 and si["profile_elective_hours"] == 600
    assert si["program_name"] == "Sistemas de Informação"


def test_public_curriculum_simulates_without_an_account(public_client):
    grid = public_client.get("/api/public/curricula/SI-2024").json()
    assert grid["curriculum"]["id"] == "SI-2024"
    assert grid["forecast"]["estimated_semesters"] == 8
    status = {c["id"]: c["status"] for c in grid["courses"]}
    assert status["edoo"] == "locked" and status["ip"] == "available"

    approved = public_client.post(
        "/api/public/curricula/SI-2024/simulations",
        json={"action": "approve", "course_id": "ip", "current_period": 2},
    ).json()
    status = {c["id"]: c["status"] for c in approved["courses"]}
    assert approved["hypothetical_ids"] == ["ip"]
    assert status["ip"] == "simulated" and status["edoo"] == "available"
    assert approved["integralization"]["mandatory"]["completed"] == 60

    blocked = public_client.post(
        "/api/public/curricula/SI-2024/simulations",
        json={"action": "approve", "course_id": "algo"},
    )
    assert blocked.status_code == 422
    assert public_client.get("/api/public/curricula/XX-0000").status_code == 404
    other = public_client.post(
        "/api/public/curricula/SI-2024/simulations", json={"hypothetical_ids": ["cc:cin0133"]}
    )
    assert other.status_code == 422
