import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base
from app.modules.curriculum.models import Course
from app.modules.curriculum.repository import list_courses
from app.seed import seed


@pytest.mark.parametrize(
    "program,year,count", [("cc", 2024, 101), ("ia", 2025, 70), ("ec", 2024, 147)]
)
def test_published_catalogs_are_complete_and_have_stable_ids(program, year, count):
    path = Path(__file__).parents[1] / "app" / "data" / f"curriculum_{program}_{year}.json"
    courses = json.loads(path.read_text())
    assert len(courses) == count
    assert len({course["id"] for course in courses}) == count
    assert all(course["id"].startswith(program + ":") for course in courses)
    assert any(course["type"] == "mandatory" for course in courses)
    assert any(course["type"] == "elective" for course in courses)
    assert all(course["prerequisite_status"] == "unverified" for course in courses)


def test_seed_loads_separate_curricula_without_overwriting_local_data():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session)
        assert len(list_courses(session, "CC-2024")) == 101
        assert len(list_courses(session, "IA-2025")) == 70
        assert len(list_courses(session, "EC-2024")) == 147
        assert len(list_courses(session, "SI-2024")) == 56
        assert session.get(Course, "ia:cin0123").name == "MATEMÁTICA DISCRETA PARA COMPUTAÇÃO"
        session.get(Course, "cc:cin0133").name = "Local edit"
        session.commit()
        before = session.scalar(select(func.count()).select_from(Course))
        seed(session)
        assert session.scalar(select(func.count()).select_from(Course)) == before
        assert session.get(Course, "cc:cin0133").name == "Local edit"
    engine.dispose()


def test_course_requires_a_curriculum():
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def enforce_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(
            Course(
                id="orphan",
                name="Sem matriz",
                short_name="Sem matriz",
                hours=60,
                period=1,
                type="mandatory",
                curriculum_id="missing",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
    engine.dispose()


@pytest.mark.parametrize(
    "values",
    [
        {"period": None},
        {"hours": 0},
        {"type": "elective", "period": 1},
    ],
)
def test_database_rejects_invalid_curricular_components(values):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    fields = (
        dict(
            id="invalid",
            name="Inválida",
            short_name="Inválida",
            hours=60,
            type="mandatory",
            period=1,
        )
        | values
    )
    with Session(engine) as session:
        session.add(Course(**fields))
        with pytest.raises(IntegrityError):
            session.commit()
    engine.dispose()
