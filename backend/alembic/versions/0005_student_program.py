"""Student program and registration verification."""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("students") as batch:
        batch.add_column(sa.Column("program", sa.String(2), nullable=False, server_default="SI"))
        batch.add_column(
            sa.Column(
                "registration_verified", sa.Boolean(), nullable=False, server_default=sa.true()
            )
        )
        batch.create_check_constraint("student_program", "program IN ('CC', 'SI', 'IA', 'EC')")


def downgrade():
    with op.batch_alter_table("students") as batch:
        batch.drop_constraint("student_program", type_="check")
        batch.drop_column("registration_verified")
        batch.drop_column("program")
