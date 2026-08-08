"""add_iva_rate_to_products_and_quotes

Revision ID: f3a1c9d4e6b2
Revises: 005abf4fb72f
Create Date: 2026-08-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a1c9d4e6b2'
down_revision: Union[str, None] = '005abf4fb72f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



# DB enum labels must match the Python Enum member NAMES (not .value) —
# SQLAlchemy's Enum type binds by member name by default, and IvaRate's
# names ("iva_0", "iva_10_5", "iva_21") differ from its values ("0", "10.5",
# "21") because Python identifiers can't start with a digit or contain dots.
iva_rate_enum = sa.Enum('iva_0', 'iva_10_5', 'iva_21', name='ivarate')


def upgrade() -> None:
    # --- products.iva_rate ---
    iva_rate_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('products', sa.Column('iva_rate', iva_rate_enum, nullable=True))
    op.execute("UPDATE products SET iva_rate = 'iva_21'")
    op.alter_column(
        'products',
        'iva_rate',
        nullable=False,
        server_default='iva_21',
    )

    # --- quotes.contempla_iva ---
    op.add_column('quotes', sa.Column('contempla_iva', sa.Boolean(), nullable=True))
    # Pre-existing quotes never had IVA added to their total — keep them
    # computing exactly the same total they always had.
    op.execute("UPDATE quotes SET contempla_iva = false")
    op.alter_column(
        'quotes',
        'contempla_iva',
        nullable=False,
        server_default='true',
    )

    # --- quote_items.iva_rate ---
    op.add_column('quote_items', sa.Column('iva_rate', sa.Numeric(precision=4, scale=2), nullable=True))
    op.execute("UPDATE quote_items SET iva_rate = 0")
    op.alter_column(
        'quote_items',
        'iva_rate',
        nullable=False,
        server_default='0',
    )


def downgrade() -> None:
    op.drop_column('quote_items', 'iva_rate')
    op.drop_column('quotes', 'contempla_iva')
    op.drop_column('products', 'iva_rate')
    iva_rate_enum.drop(op.get_bind(), checkfirst=True)
