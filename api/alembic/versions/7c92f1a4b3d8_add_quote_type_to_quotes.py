"""add_quote_type_to_quotes

Revision ID: 7c92f1a4b3d8
Revises: 05e79b44bd97
Create Date: 2026-09-11 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c92f1a4b3d8'
# NOTE: chained onto '05e79b44bd97' (main's true head), NOT '35cb4c80ac4a'
# (PR1's migration). PR1 and PR3 are independent, parallelizable PRs (see
# design/tasks dependency graph) — this migration must apply cleanly on top
# of `main` alone, without requiring PR1 to have merged first. This
# intentionally creates two branch heads once PR1's migration also exists
# ('05e79b44bd97' -> '35cb4c80ac4a' from PR1, '05e79b44bd97' -> '7c92f1a4b3d8'
# from this PR). TODO: whichever of PR1/PR3 merges to main SECOND must add an
# `alembic merge heads` migration (or the merging engineer runs
# `alembic merge -m "merge_supplies_and_quote_type" heads` and commits the
# result) to reconcile the two heads back into one linear chain.
down_revision: Union[str, None] = '05e79b44bd97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# DB enum labels must match the Python Enum member NAMES (not .value) — for
# QuoteType name == value ("productos"/"servicios"), so this is a non-issue
# here, but written from the names as a habit (see f3a1c9d4e6b2).
quote_type_enum = sa.Enum('productos', 'servicios', name='quotetype')


def upgrade() -> None:
    # CREATE TYPE + immediate use in one statement/transaction is legal —
    # unlike ALTER TYPE ... ADD VALUE (which needs autocommit_block, see the
    # QuoteItemKind.supply migration), a brand-new type has no such
    # restriction. Backfill value == going-forward default, so this is a
    # single add_column with server_default, no separate UPDATE step needed
    # (unlike the 3-step idiom in f3a1c9d4e6b2, where backfill != default).
    quote_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'quotes',
        sa.Column(
            'quote_type',
            quote_type_enum,
            nullable=False,
            server_default='productos',
        ),
    )


def downgrade() -> None:
    op.drop_column('quotes', 'quote_type')
    quote_type_enum.drop(op.get_bind(), checkfirst=True)
