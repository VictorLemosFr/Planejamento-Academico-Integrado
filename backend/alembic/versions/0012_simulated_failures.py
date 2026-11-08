"""Reprovações simuladas por alternativa.

Cada plano guarda as disciplinas em andamento que o estudante imagina reprovar, com a
nota simulada da reprovação (opcional). Nada disso toca o histórico informado.
"""

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "plans",
        sa.Column("simulated_failures", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade():
    op.drop_column("plans", "simulated_failures")
