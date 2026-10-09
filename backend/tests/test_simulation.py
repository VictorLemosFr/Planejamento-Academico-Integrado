import pytest

from app.modules.planning.service import simulate

# Uma cadeia pequena torna as expectativas independentes dos dados demonstrativos.
COURSES = [
    {
        "id": "intro",
        "name": "Introdução",
        "period": 1,
        "hours": 60,
        "type": "mandatory",
        "prerequisite_ids": [],
    },
    {
        "id": "data",
        "name": "Estruturas",
        "period": 2,
        "hours": 60,
        "type": "mandatory",
        "prerequisite_ids": ["intro"],
    },
    {
        "id": "alg",
        "name": "Algoritmos",
        "period": 3,
        "hours": 60,
        "type": "mandatory",
        "prerequisite_ids": ["data"],
    },
    {
        "id": "optional",
        "name": "Eletiva",
        "period": None,
        "hours": 60,
        "type": "elective",
        "prerequisite_ids": ["data"],
    },
]


def run(completed=(), planned=(), action=None, courses=COURSES):
    return simulate(
        courses,
        current_period=3,
        completed_ids=list(completed),
        planned_ids=list(planned),
        action=action,
    )


def by_id(result):
    return {course["id"]: course for course in result["courses"]}


def test_planning_does_not_release_prerequisites():
    result = run(["intro"], action={"kind": "plan", "course_id": "data"})
    assert result["planned_ids"] == ["data"]
    assert by_id(result)["data"]["status"] == "planned"
    assert by_id(result)["alg"]["status"] == "locked"
    assert result["planned_hours"] == 60


def test_approval_releases_direct_dependents_but_not_the_next_chain():
    result = run(action={"kind": "approve", "course_id": "intro"})
    assert by_id(result)["data"]["status"] == "pending"
    assert by_id(result)["alg"]["missing_prerequisite_ids"] == ["data"]
    assert by_id(result)["intro"]["dependent_ids"] == ["alg", "data", "optional"]


def test_revoke_removes_dependent_approvals_and_invalid_plans():
    result = run(["intro", "data"], ["alg", "optional"], {"kind": "revoke", "course_id": "intro"})
    assert result["completed_ids"] == []
    assert result["planned_ids"] == []
    assert by_id(result)["alg"]["status"] == "locked"


@pytest.mark.parametrize("kind", ["approve", "plan"])
def test_rejects_action_with_unmet_prerequisites(kind):
    with pytest.raises(ValueError, match="pré-requisitos"):
        run(action={"kind": kind, "course_id": "data"})


def test_rejects_unknown_course_instead_of_silently_ignoring_it():
    with pytest.raises(ValueError, match="desconhecida"):
        run(["missing"])


def test_rejects_inconsistent_completed_history():
    with pytest.raises(ValueError, match="pré-requisitos"):
        run(["data"])


def test_rejects_cycle_in_curriculum():
    cyclic = [dict(COURSES[0], prerequisite_ids=["data"]), COURSES[1]]
    with pytest.raises(ValueError, match="ciclo"):
        run(courses=cyclic)


def test_approval_removes_course_from_plan():
    result = run(["intro"], ["data"], {"kind": "approve", "course_id": "data"})
    assert result["planned_ids"] == []
    assert result["completed_ids"] == ["data", "intro"]
    assert by_id(result)["alg"]["status"] == "available"


def test_unplan_keeps_completed_history():
    result = run(["intro"], ["data"], {"kind": "unplan", "course_id": "data"})
    assert result["planned_ids"] == []
    assert result["completed_ids"] == ["intro"]
