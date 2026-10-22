"""Carrega dados demonstrativos sem substituir registros existentes."""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.database import engine
from app.modules.constraints.service import CurriculumGraph
from app.modules.curriculum.models import Course, Curriculum, Prerequisite

CATALOGS = (
    ("SI-demo", "SI", "0000.1", "app/data/curriculum.json", "curriculum.json"),
    (
        "CC-2024",
        "CC",
        "2024.1",
        "https://portal.cin.ufpe.br/graduacao/ciencia-da-computacao/",
        "curriculum_cc_2024.json",
    ),
    (
        "IA-2025",
        "IA",
        "2025.1",
        "https://portal.cin.ufpe.br/graduacao/inteligencia-artificial/",
        "curriculum_ia_2025.json",
    ),
    (
        "EC-2024",
        "EC",
        "2024.1",
        "https://portal.cin.ufpe.br/graduacao/engenharia-da-computacao/",
        "curriculum_ec_2024.json",
    ),
)


def seed(session: Session):
    catalogs = []
    seen_ids = set()
    for curriculum_id, program, valid_from, source_url, filename in CATALOGS:
        courses = json.loads((Path(__file__).parent / "data" / filename).read_text())
        ids = [course["id"] for course in courses]
        if len(set(ids)) != len(ids) or seen_ids.intersection(ids):
            raise ValueError(f"IDs repetidos na matriz {curriculum_id}.")
        seen_ids.update(ids)
        CurriculumGraph(courses)
        catalogs.append((curriculum_id, program, valid_from, source_url, courses))
    for curriculum_id, program, valid_from, source_url, courses in catalogs:
        if session.get(Curriculum, curriculum_id) is None:
            session.add(
                Curriculum(
                    id=curriculum_id,
                    program=program,
                    valid_from=valid_from,
                    source_url=source_url,
                )
            )
        for course in courses:
            if session.get(Course, course["id"]) is None:
                session.add(
                    Course(
                        **{
                            key: value for key, value in course.items() if key != "prerequisite_ids"
                        },
                        curriculum_id=curriculum_id,
                    )
                )
    session.flush()
    for _, _, _, _, courses in catalogs:
        for course in courses:
            for prerequisite_id in course["prerequisite_ids"]:
                key = (course["id"], prerequisite_id)
                if session.get(Prerequisite, key) is None:
                    session.add(
                        Prerequisite(course_id=course["id"], prerequisite_id=prerequisite_id)
                    )
    session.commit()


if __name__ == "__main__":
    with Session(engine) as session:
        seed(session)
    print("Dados demonstrativos carregados. Nenhum registro existente foi substituído.")
