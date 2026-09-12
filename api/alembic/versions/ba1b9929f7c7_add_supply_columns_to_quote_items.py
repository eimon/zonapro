"""add_supply_columns_to_quote_items

Revision ID: ba1b9929f7c7
Revises: f4d258c47039
Create Date: 2026-09-11 20:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba1b9929f7c7'
down_revision: Union[str, None] = 'f4d258c47039'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All three columns are NULLABLE and stay NULL forever for kind=product
    # and kind=service rows — only kind=supply items populate them, mirroring
    # the existing product_variant_id/product_name_snapshot/product_sku_snapshot
    # trio exactly. No backfill needed (no pre-existing kind=supply rows can
    # exist before this migration), so this is a single straightforward
    # add_column step per column, not the 3-step nullable->UPDATE->NOT NULL
    # idiom used in f3a1c9d4e6b2 (that idiom is for columns that must become
    # NOT NULL with a backfill; these stay nullable indefinitely).
    op.add_column(
        'quote_items',
        sa.Column('supply_variant_id', sa.UUID(), nullable=True),
    )
    op.add_column(
        'quote_items',
        sa.Column('supply_name_snapshot', sa.String(length=300), nullable=True),
    )
    op.add_column(
        'quote_items',
        sa.Column('supply_sku_snapshot', sa.String(length=100), nullable=True),
    )
    op.create_foreign_key(
        'fk_quote_items_supply_variant_id_supply_variants',
        'quote_items',
        'supply_variants',
        ['supply_variant_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_quote_items_supply_variant_id_supply_variants',
        'quote_items',
        type_='foreignkey',
    )
    op.drop_column('quote_items', 'supply_sku_snapshot')
    op.drop_column('quote_items', 'supply_name_snapshot')
    op.drop_column('quote_items', 'supply_variant_id')
