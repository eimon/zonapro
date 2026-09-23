"""add_construccion_to_quotetype

Revision ID: a1b2c3d4e5f6
Revises: ba1b9929f7c7
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'ba1b9929f7c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Same idiom as f4d258c47039 (add 'supply' to quoteitemkind): PostgreSQL
    # cannot use a newly added enum label within the same transaction that
    # added it, and Alembic wraps each revision in one transaction by
    # default. autocommit_block() runs this statement in its own
    # auto-committed transaction, separate from the revision's implicit one.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE quotetype ADD VALUE IF NOT EXISTS 'construccion'")


def downgrade() -> None:
    # PostgreSQL has no `ALTER TYPE ... DROP VALUE` — enum labels cannot be
    # removed once added, only the whole type can be dropped and recreated
    # (which would require rewriting the `quotes.quote_type` column,
    # including any existing rows using 'construccion'). This is a
    # documented, intentional no-op, mirroring f4d258c47039's downgrade.
    pass
