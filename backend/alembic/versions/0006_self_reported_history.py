"""Replace manual registration approval with the student's start term."""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("students") as batch:
        batch.add_column(sa.Column("start_term", sa.String(6), nullable=True))
        batch.add_column(
            sa.Column(
                "coordination_managed", sa.Boolean(), nullable=False, server_default=sa.true()
            )
        )
    op.execute(sa.text("UPDATE students SET coordination_managed = registration_verified"))
    with op.batch_alter_table("students") as batch:
        batch.drop_column("registration_verified")


def downgrade():
    with op.batch_alter_table("students") as batch:
        batch.add_column(
            sa.Column(
                "registration_verified", sa.Boolean(), nullable=False, server_default=sa.true()
            )
        )
    op.execute(sa.text("UPDATE students SET registration_verified = coordination_managed"))
    with op.batch_alter_table("students") as batch:
        batch.drop_column("coordination_managed")
        batch.drop_column("start_term")
