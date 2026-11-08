"""Share a saved plan through a read-only link.

The token is the capability: anyone holding the link sees the plan without grades,
CR, failures or identity. Revoking clears it; deleting the plan removes it too.
"""

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("plans") as batch:
        batch.add_column(sa.Column("share_token", sa.String(64), nullable=True))
        batch.create_unique_constraint("plan_share_token", ["share_token"])


def downgrade():
    with op.batch_alter_table("plans") as batch:
        batch.drop_constraint("plan_share_token", type_="unique")
        batch.drop_column("share_token")
