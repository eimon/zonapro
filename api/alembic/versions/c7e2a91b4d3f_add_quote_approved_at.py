"""add_quote_approved_at

Adds quotes.approved_at, set when a quote transitions to "aprobada".
Existing approved quotes have no recorded approval date, so updated_at is
used as the best available approximation.

Revision ID: c7e2a91b4d3f
Revises: 9f2c069d717d
Create Date: 2026-10-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7e2a91b4d3f'
down_revision: Union[str, None] = '9f2c069d717d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('quotes', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE quotes SET approved_at = updated_at WHERE status = 'aprobada'")


def downgrade() -> None:
    op.drop_column('quotes', 'approved_at')
