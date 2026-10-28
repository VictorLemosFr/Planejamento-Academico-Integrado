from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Curriculum(Base):
    __tablename__ = "curricula"
    __table_args__ = (
        CheckConstraint("program IN ('CC', 'SI', 'IA', 'EC')", name="curriculum_program"),
    )
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    program: Mapped[str] = mapped_column(String(2))
    valid_from: Mapped[str] = mapped_column(String(6))
    source_url: Mapped[str] = mapped_column(String(512))
    # Requisitos publicados pela fonte; ausentes ficam nulos em vez de estimados.
    official_mandatory_hours: Mapped[int | None] = mapped_column(nullable=True)
    profile_elective_hours: Mapped[int | None] = mapped_column(nullable=True)
    free_elective_hours: Mapped[int | None] = mapped_column(nullable=True)
    complementary_hours: Mapped[int | None] = mapped_column(nullable=True)
    extension_hours: Mapped[int | None] = mapped_column(nullable=True)
    total_hours: Mapped[int | None] = mapped_column(nullable=True)
    standard_semesters: Mapped[int | None] = mapped_column(nullable=True)


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
        CheckConstraint(
            "prerequisite_status IN ('verified', 'unverified')",
            name="course_prerequisite_status",
        ),
    )
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    curriculum_id: Mapped[str] = mapped_column(ForeignKey("curricula.id"), default="SI-2024")
    source_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    prerequisite_status: Mapped[str] = mapped_column(String(12), default="unverified")
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
