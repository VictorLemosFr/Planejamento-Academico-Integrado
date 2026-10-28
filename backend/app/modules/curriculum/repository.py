from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.curriculum.models import Course, Prerequisite


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
            "prerequisite_status": course.prerequisite_status,
        }
        for course in courses
    ]
