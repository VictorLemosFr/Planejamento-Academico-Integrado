"""Carrega as matrizes atendidas sem substituir registros existentes.

Correções de dados em bancos já populados são feitas por migrações do Alembic,
pois o seed apenas insere o que falta.
"""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.database import engine
from app.modules.constraints.service import CurriculumGraph
from app.modules.curriculum.catalog import CATALOGS, REQUIREMENT_FIELDS
from app.modules.curriculum.models import Corequisite, Course, Curriculum, Prerequisite


def load_catalog(catalog):
    return json.loads((Path(__file__).parent / "data" / catalog["filename"]).read_text())


def seed(session: Session):
    catalogs = []
    seen_ids = set()
    for catalog in CATALOGS:
        courses = load_catalog(catalog)
        ids = [course["id"] for course in courses]
        if len(set(ids)) != len(ids) or seen_ids.intersection(ids):
            raise ValueError(f"IDs repetidos na matriz {catalog['id']}.")
        seen_ids.update(ids)
        CurriculumGraph(courses)
        catalogs.append((catalog, courses))
    for catalog, courses in catalogs:
        if session.get(Curriculum, catalog["id"]) is None:
            session.add(
                Curriculum(
                    id=catalog["id"],
                    program=catalog["program"],
                    valid_from=catalog["valid_from"],
                    source_url=catalog["source_url"],
                    **{field: catalog[field] for field in REQUIREMENT_FIELDS},
                )
            )
        for course in courses:
            if session.get(Course, course["id"]) is None:
                session.add(
                    Course(
                        **{
                            key: value
                            for key, value in course.items()
                            if key not in {"prerequisite_ids", "corequisite_ids"}
                        },
                        curriculum_id=catalog["id"],
                    )
                )
    session.flush()
    for _, courses in catalogs:
        for course in courses:
            for prerequisite_id in course["prerequisite_ids"]:
                key = (course["id"], prerequisite_id)
                if session.get(Prerequisite, key) is None:
                    session.add(
                        Prerequisite(course_id=course["id"], prerequisite_id=prerequisite_id)
                    )
            for corequisite_id in course.get("corequisite_ids", []):
                key = (course["id"], corequisite_id)
                if session.get(Corequisite, key) is None:
                    session.add(Corequisite(course_id=course["id"], corequisite_id=corequisite_id))
    session.commit()


if __name__ == "__main__":
    with Session(engine) as session:
        seed(session)
    print("Matrizes carregadas. Nenhum registro existente foi substituído.")
