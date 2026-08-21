"""add_global_sku_unique_index

Revision ID: 05e79b44bd97
Revises: 8a2f5c7e1d9b
Create Date: 2026-08-20 21:52:43.078183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05e79b44bd97'
down_revision: Union[str, None] = '8a2f5c7e1d9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Pre-flight: abort loudly if two active variants already share a SKU ---
    # (none exist today, verified manually, but this migration must still guard
    # for whenever it actually runs against a different environment/history)
    duplicates = op.get_bind().execute(
        sa.text(
            """
            SELECT sku, count(*) AS n FROM product_variants
            WHERE deleted_at IS NULL GROUP BY sku HAVING count(*) > 1 ORDER BY sku
            """
        )
    ).fetchall()
    if duplicates:
        detail = ", ".join(f"{row.sku} (x{row.n})" for row in duplicates)
        raise RuntimeError(
            "Cannot create uq_variant_sku_active: duplicate active SKUs exist. "
            f"Resolve these first: {detail}"
        )

    op.create_index(
        "uq_variant_sku_active",
        "product_variants",
        ["sku"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_variant_sku_active",
        table_name="product_variants",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
