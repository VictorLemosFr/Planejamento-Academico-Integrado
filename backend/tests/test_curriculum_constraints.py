import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base
from app.modules.curriculum.models import Course


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
