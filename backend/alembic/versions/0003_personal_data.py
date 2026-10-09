"""Identity, immutable imported history and owned semester alternatives."""

import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.CheckConstraint("role IN ('student', 'coordination')", name="user_role"),
    )
    op.create_table(
        "students",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("registration", sa.String(80), nullable=False, unique=True),
        sa.Column("current_period", sa.Integer(), nullable=False),
        sa.Column("history_revision", sa.Integer(), nullable=False),
        sa.CheckConstraint("current_period BETWEEN 1 AND 20", name="student_period"),
        sa.CheckConstraint("history_revision >= 0", name="student_revision"),
    )
    op.create_table(
        "login_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("csrf_token", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_sessions_user_id", "login_sessions", ["user_id"])
    op.create_index("ix_login_sessions_expires_at", "login_sessions", ["expires_at"])
    op.create_table(
        "history_imports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.UniqueConstraint("student_id", "revision"),
    )
    op.create_table(
        "academic_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("import_id", sa.String(36), sa.ForeignKey("history_imports.id"), nullable=False),
        sa.Column("course_id", sa.String(40), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("academic_term", sa.String(6), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.UniqueConstraint("import_id", "course_id", "academic_term"),
        sa.CheckConstraint(
            "status IN ('completed', 'in_progress', 'failed')", name="record_status"
        ),
    )
    op.create_table(
        "plans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("target_term", sa.String(6), nullable=False),
        sa.Column("planned_ids", sa.JSON(), nullable=False),
        sa.Column("hypothetical_ids", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version > 0", name="plan_version"),
    )
    op.create_index("ix_plans_student_id", "plans", ["student_id"])


def downgrade():
    for table in [
        "plans",
        "academic_records",
        "history_imports",
        "login_sessions",
        "students",
        "users",
    ]:
        op.drop_table(table)
