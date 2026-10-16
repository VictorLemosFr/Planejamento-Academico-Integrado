"""Personal data is separate from the demonstrative curriculum."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def identifier():
    return str(uuid4())


def now():
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('student', 'coordination')", name="user_role"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(default=True)


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint("current_period BETWEEN 1 AND 20", name="student_period"),
        CheckConstraint("history_revision >= 0", name="student_revision"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    registration: Mapped[str] = mapped_column(String(80), unique=True)
    current_period: Mapped[int] = mapped_column(default=1)
    history_revision: Mapped[int] = mapped_column(default=0)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class HistoryImport(Base):
    __tablename__ = "history_imports"
    __table_args__ = (UniqueConstraint("student_id", "revision"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"))
    revision: Mapped[int]
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    content_hash: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)
    warnings: Mapped[list] = mapped_column(JSON)


class AcademicRecord(Base):
    __tablename__ = "academic_records"
    __table_args__ = (
        UniqueConstraint("import_id", "course_id", "academic_term"),
        CheckConstraint("status IN ('completed', 'in_progress', 'failed')", name="record_status"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    import_id: Mapped[str] = mapped_column(ForeignKey("history_imports.id"))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"))
    academic_term: Mapped[str] = mapped_column(String(6))
    status: Mapped[str] = mapped_column(String(20))


class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = (CheckConstraint("version > 0", name="plan_version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    target_term: Mapped[str] = mapped_column(String(6))
    planned_ids: Mapped[list] = mapped_column(JSON, default=list)
    hypothetical_ids: Mapped[list] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
