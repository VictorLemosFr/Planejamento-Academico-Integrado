import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base
from app.modules.curriculum.models import Course


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
