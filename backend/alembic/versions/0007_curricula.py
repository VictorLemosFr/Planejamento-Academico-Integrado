"""Associate courses with versioned curricula without renaming SI records."""

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "curricula",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("program", sa.String(2), nullable=False),
        sa.Column("valid_from", sa.String(6), nullable=False),
        sa.Column("source_url", sa.String(512), nullable=False),
        sa.CheckConstraint("program IN ('CC', 'SI', 'IA', 'EC')", name="curriculum_program"),
    )
    op.execute(
        sa.text(
            "INSERT INTO curricula (id, program, valid_from, source_url) "
            "VALUES ('SI-demo', 'SI', '0000.1', 'app/data/curriculum.json')"
        )
    )
    with op.batch_alter_table("courses") as batch:
        batch.add_column(
            sa.Column("curriculum_id", sa.String(32), nullable=False, server_default="SI-demo")
        )
        batch.add_column(sa.Column("source_code", sa.String(40), nullable=True))
        batch.add_column(
            sa.Column(
                "prerequisite_status",
                sa.String(12),
                nullable=False,
                server_default="unverified",
            )
        )
        batch.create_foreign_key("course_curriculum", "curricula", ["curriculum_id"], ["id"])
        batch.create_check_constraint(
            "course_prerequisite_status", "prerequisite_status IN ('verified', 'unverified')"
        )


def downgrade():
    with op.batch_alter_table("courses") as batch:
        batch.drop_constraint("course_prerequisite_status", type_="check")
        batch.drop_constraint("course_curriculum", type_="foreignkey")
        batch.drop_column("prerequisite_status")
        batch.drop_column("source_code")
        batch.drop_column("curriculum_id")
    op.drop_table("curricula")
