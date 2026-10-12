"""remove_hourly_rate

Revision ID: 9f2c069d717d
Revises: 8a178ec1966f
Create Date: 2026-09-27 02:34:19.976170

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f2c069d717d'
down_revision: Union[str, None] = '8a178ec1966f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# The hourly-rate feature was never wired into the UI: item prices were
# always entered manually and the rate was only snapshotted, never used in
# any calculation. Removing the columns and settings rows loses no priced
# data.
def upgrade() -> None:
    op.drop_column('quote_items', 'hourly_rate_snapshot')
    op.drop_column('quote_items', 'hours')
    op.execute("DELETE FROM app_settings WHERE key IN ('hourly_rate_ars', 'hourly_rate_usd')")


# Restores the schema only; deleted rate settings and snapshots are not
# recoverable (the previous revision reads a missing rate as 0).
def downgrade() -> None:
    op.add_column('quote_items', sa.Column('hours', sa.NUMERIC(precision=8, scale=2), autoincrement=False, nullable=True))
    op.add_column('quote_items', sa.Column('hourly_rate_snapshot', sa.NUMERIC(precision=12, scale=2), autoincrement=False, nullable=True))
