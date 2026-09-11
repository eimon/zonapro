"""add_supply_to_quoteitemkind

Revision ID: f4d258c47039
Revises: 35cb4c80ac4a, 7c92f1a4b3d8
Create Date: 2026-09-11 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f4d258c47039'
# --- down_revision reasoning (PR5, verified against `alembic heads` before
# writing this file) ---
# PR5 depends on BOTH PR1 (`35cb4c80ac4a` — creates `supply_variants`, whose
# PK the next migration's `quote_items.supply_variant_id` FK will reference)
# and PR3 (`7c92f1a4b3d8` — `quotes.quote_type` + `ALLOWED_ITEM_KINDS`, the
# app-level gate this enum value feeds into). Both currently sit as two
# independent heads off the shared branchpoint `05e79b44bd97` (confirmed via
# `alembic heads` immediately before writing this migration — see PR3's
# `7c92f1a4b3d8` TODO comment, which flagged that whichever PR lands second
# needs a merge). Rather than picking one head arbitrarily (which would still
# leave two heads once the other PR's migration also exists, deferring the
# merge to yet another future migration), this revision uses a MULTI-PARENT
# `down_revision` tuple to merge both heads directly into the migration that
# actually needs them both. This is the natural merge point: PR5's own
# feature work (the `supply` enum value) has a real, load-bearing dependency
# on both parents, unlike a content-free `alembic merge heads` migration.
# Net effect: after this migration, `alembic heads` returns exactly one head.
down_revision: Union[str, tuple[str, ...], None] = ('35cb4c80ac4a', '7c92f1a4b3d8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL cannot use a newly added enum label within the same
    # transaction that added it, and Alembic wraps each revision in one
    # transaction by default. `autocommit_block()` is the sanctioned escape
    # hatch: it runs this statement in its own auto-committed transaction,
    # separate from the revision's implicit transaction (D3).
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE quoteitemkind ADD VALUE IF NOT EXISTS 'supply'")


def downgrade() -> None:
    # PostgreSQL has no `ALTER TYPE ... DROP VALUE` — enum labels cannot be
    # removed once added, only the whole type can be dropped and recreated
    # (which would require rewriting every column using it, including
    # `quote_items.kind` and any existing rows using 'supply'). This is a
    # documented, intentional no-op: the orphan 'supply' label survives
    # downgrade, harmlessly unused. This mirrors the exact tradeoff already
    # accepted for other enum-add migrations in this repo's design.
    pass
