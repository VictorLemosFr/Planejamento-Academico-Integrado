"""Obrigatórias exigem período; CHECK SQL deve rejeitar NULL explicitamente."""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("course_period", "courses", type_="check")
    op.create_check_constraint(
        "course_period",
        "courses",
        "(type = 'mandatory' AND period IS NOT NULL AND period > 0) "
        "OR (type = 'elective' AND period IS NULL)",
    )


def downgrade():
    op.drop_constraint("course_period", "courses", type_="check")
    op.create_check_constraint(
        "course_period",
        "courses",
        "(type = 'mandatory' AND period > 0) OR (type = 'elective' AND period IS NULL)",
    )
