from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.curriculum.models import Course, Prerequisite


def list_courses(session: Session):
    prerequisites = {}
    for row in session.scalars(select(Prerequisite).order_by(Prerequisite.prerequisite_id)):
        prerequisites.setdefault(row.course_id, []).append(row.prerequisite_id)
    courses = session.scalars(select(Course).order_by(Course.period, Course.name))
    return [
        {
            "id": course.id,
            "name": course.name,
            "short_name": course.short_name,
            "period": course.period,
            "hours": course.hours,
            "type": course.type,
            "prerequisite_ids": prerequisites.get(course.id, []),
        }
        for course in courses
    ]
