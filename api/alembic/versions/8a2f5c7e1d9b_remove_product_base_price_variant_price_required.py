"""remove_product_base_price_variant_price_required

Revision ID: 8a2f5c7e1d9b
Revises: f3a1c9d4e6b2
Create Date: 2026-08-07 00:00:00.000000

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a2f5c7e1d9b'
down_revision: Union[str, None] = 'f3a1c9d4e6b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # --- Defensive backfill: any product with zero non-deleted variants ---
    # (should affect zero rows in practice — every product created via the
    # service already carries at least one variant — but we don't want a
    # data-model consolidation to silently orphan a product with no price
    # at all if this assumption is ever wrong for legacy rows.)
    orphan_products = bind.execute(
        sa.text(
            """
            SELECT id, slug, base_price FROM products
            WHERE NOT EXISTS (
                SELECT 1 FROM product_variants
                WHERE product_variants.product_id = products.id
                AND product_variants.deleted_at IS NULL
            )
            """
        )
    ).fetchall()

    now = datetime.now(timezone.utc)
    for row in orphan_products:
        bind.execute(
            sa.text(
                """
                INSERT INTO product_variants
                    (id, product_id, sku, name, attributes, price, stock_qty, created_at, updated_at)
                VALUES
                    (:id, :product_id, :sku, 'Único', '{}', :price, 0, :created_at, :updated_at)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "product_id": row.id,
                "sku": row.slug,
                "price": row.base_price,
                "created_at": now,
                "updated_at": now,
            },
        )

    # --- Defensive: null-price variants (shouldn't exist, but be safe) ---
    op.execute("UPDATE product_variants SET price = 0 WHERE price IS NULL")

    # --- Tighten product_variants.price to NOT NULL ---
    op.alter_column('product_variants', 'price', nullable=False)
    op.drop_constraint('ck_variant_price_non_negative', 'product_variants', type_='check')
    op.create_check_constraint(
        'ck_variant_price_non_negative',
        'product_variants',
        'price >= 0',
    )

    # --- Drop products.base_price ---
    op.drop_constraint('ck_product_base_price_non_negative', 'products', type_='check')
    op.drop_column('products', 'base_price')


def downgrade() -> None:
    # Lossy: this can't reconstruct per-product pricing from multiple
    # variants. Every product gets base_price=0 back; that's expected for a
    # downgrade of a data-model consolidation.
    op.add_column(
        'products',
        sa.Column('base_price', sa.Numeric(12, 2), nullable=False, server_default='0'),
    )
    op.create_check_constraint(
        'ck_product_base_price_non_negative',
        'products',
        'base_price >= 0',
    )

    op.drop_constraint('ck_variant_price_non_negative', 'product_variants', type_='check')
    op.create_check_constraint(
        'ck_variant_price_non_negative',
        'product_variants',
        'price IS NULL OR price >= 0',
    )
    op.alter_column('product_variants', 'price', nullable=True)
