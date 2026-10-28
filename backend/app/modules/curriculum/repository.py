from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.curriculum.catalog import PROGRAM_NAMES, REQUIREMENT_FIELDS
from app.modules.curriculum.models import Corequisite, Course, Prerequisite


def list_courses(session: Session, curriculum_id: str = "SI-2024"):
    courses = list(
        session.scalars(
            select(Course)
            .where(Course.curriculum_id == curriculum_id)
            .order_by(Course.period, Course.name)
        )
    )
    ids = {course.id for course in courses}
    prerequisites = {}
    for row in session.scalars(
        select(Prerequisite)
        .where(Prerequisite.course_id.in_(ids))
        .order_by(Prerequisite.prerequisite_id)
    ):
        prerequisites.setdefault(row.course_id, []).append(row.prerequisite_id)
    corequisites = {}
    for row in session.scalars(
        select(Corequisite)
        .where(Corequisite.course_id.in_(ids))
        .order_by(Corequisite.corequisite_id)
    ):
        corequisites.setdefault(row.course_id, []).append(row.corequisite_id)
    return [
        {
            "id": course.id,
            "source_code": course.source_code,
            "name": course.name,
            "short_name": course.short_name,
            "period": course.period,
            "hours": course.hours,
            "type": course.type,
            "prerequisite_ids": prerequisites.get(course.id, []),
            "corequisite_ids": corequisites.get(course.id, []),
            "prerequisite_status": course.prerequisite_status,
        }
        for course in courses
    ]


def requirements_view(curriculum):
    """Requisitos publicados da matriz, usados na integralização e na previsão."""
    return {
        "id": curriculum.id,
        "program": curriculum.program,
        "program_name": PROGRAM_NAMES.get(curriculum.program, curriculum.program),
        "valid_from": curriculum.valid_from,
        "source_url": curriculum.source_url,
        **{field: getattr(curriculum, field) for field in REQUIREMENT_FIELDS},
    }
