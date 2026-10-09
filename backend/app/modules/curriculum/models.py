from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint("hours > 0", name="positive_hours"),
        CheckConstraint("type IN ('mandatory', 'elective')", name="course_type"),
        CheckConstraint(
            "(type = 'mandatory' AND period IS NOT NULL AND period > 0) "
            "OR (type = 'elective' AND period IS NULL)",
            name="course_period",
        ),
    )
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    short_name: Mapped[str] = mapped_column(String(100))
    hours: Mapped[int]
    period: Mapped[int | None]
    type: Mapped[str] = mapped_column(String(20))


class Prerequisite(Base):
    __tablename__ = "prerequisites"
    __table_args__ = (CheckConstraint("course_id <> prerequisite_id", name="no_self_prerequisite"),)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), primary_key=True)
    prerequisite_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), primary_key=True)
