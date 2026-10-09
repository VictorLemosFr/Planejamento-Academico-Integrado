"""Carrega dados demonstrativos sem substituir registros existentes."""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.database import engine
from app.modules.constraints.service import CurriculumGraph
from app.modules.curriculum.models import Course, Prerequisite


def seed(session: Session):
    courses = json.loads((Path(__file__).parent / "data" / "curriculum.json").read_text())
    CurriculumGraph(courses)
    for course in courses:
        if session.get(Course, course["id"]) is None:
            session.add(
                Course(**{key: value for key, value in course.items() if key != "prerequisite_ids"})
            )
    session.flush()
    for course in courses:
        for prerequisite_id in course["prerequisite_ids"]:
            key = (course["id"], prerequisite_id)
            if session.get(Prerequisite, key) is None:
                session.add(Prerequisite(course_id=course["id"], prerequisite_id=prerequisite_id))
    session.commit()


if __name__ == "__main__":
    with Session(engine) as session:
        seed(session)
    print("Dados demonstrativos carregados. Nenhum registro existente foi substituído.")
