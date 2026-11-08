"""Record grades, course credits and simulated grades for the CR.

Credits come from the "Nº de créditos" field of each component program in the PPCs,
frozen in 0010_credits.json. Existing values are never overwritten.
"""

import json
from pathlib import Path

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

CREDITS = json.loads(Path(__file__).with_name("0010_credits.json").read_text())


def upgrade():
    with op.batch_alter_table("courses") as batch:
        batch.add_column(sa.Column("credits", sa.Integer(), nullable=True))
    with op.batch_alter_table("academic_records") as batch:
        batch.add_column(sa.Column("grade", sa.Numeric(4, 2), nullable=True))
        batch.create_check_constraint(
            "record_grade", "grade IS NULL OR (grade >= 0 AND grade <= 10)"
        )
    with op.batch_alter_table("plans") as batch:
        batch.add_column(
            sa.Column("simulated_grades", sa.JSON(), nullable=False, server_default="{}")
        )
    connection = op.get_bind()
    for course_id, credits in CREDITS.items():
        connection.execute(
            sa.text("UPDATE courses SET credits = :credits WHERE id = :id AND credits IS NULL"),
            {"id": course_id, "credits": credits},
        )


def downgrade():
    with op.batch_alter_table("plans") as batch:
        batch.drop_column("simulated_grades")
    with op.batch_alter_table("academic_records") as batch:
        batch.drop_constraint("record_grade", type_="check")
        batch.drop_column("grade")
    with op.batch_alter_table("courses") as batch:
        batch.drop_column("credits")
