"""Grade curricular e dependências."""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "courses",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("short_name", sa.String(100), nullable=False),
        sa.Column("hours", sa.Integer(), nullable=False),
        sa.Column("period", sa.Integer()),
        sa.Column("type", sa.String(20), nullable=False),
        sa.CheckConstraint("hours > 0", name="positive_hours"),
        sa.CheckConstraint("type IN ('mandatory', 'elective')", name="course_type"),
        sa.CheckConstraint(
            "(type = 'mandatory' AND period > 0) OR (type = 'elective' AND period IS NULL)",
            name="course_period",
        ),
    )
    op.create_table(
        "prerequisites",
        sa.Column("course_id", sa.String(40), sa.ForeignKey("courses.id"), primary_key=True),
        sa.Column("prerequisite_id", sa.String(40), sa.ForeignKey("courses.id"), primary_key=True),
        sa.CheckConstraint("course_id <> prerequisite_id", name="no_self_prerequisite"),
    )


def downgrade():
    op.drop_table("prerequisites")
    op.drop_table("courses")
