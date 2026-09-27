"""add_multi_currency_prices

Revision ID: 8a178ec1966f
Revises: acfb66d3b286
Create Date: 2026-09-27 00:17:09.767109

Hand-written (NOT the raw autogenerate output) — see CLAUDE.md: autogenerate
turns renames into drop+add, which would destroy every existing price. This
migration renames columns in place with `op.alter_column(new_column_name=...)`
and preserves values.

Confirmed data semantics (product decision): every price value currently
stored in the database is actually a USD amount. So:
  - product_variants.price / supply_variants.price -> price_usd (value kept),
    price_ars added as NULL.
  - packages.pricing_value in 'final_price' mode -> pricing_value_usd (value
    kept), pricing_value_ars added as NULL.
  - packages.pricing_value in 'discount_percent' mode is NOT a currency
    amount (it's a 0-100 percent), so it moves to the new, currency-independent
    `discount_percent` column instead — see the schema note on the Package
    model for the full pricing-mode contract.
  - quotes.currency backfills to 'USD' for every existing row.
  - the single-key `hourly_rate` app_setting becomes `hourly_rate_usd` (value
    kept); `hourly_rate_ars` is intentionally left unset (defaults to "0" at
    read time, same fallback the app already used for a missing setting).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a178ec1966f'
down_revision: Union[str, None] = 'acfb66d3b286'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── product_variants: price -> price_usd (+ price_ars) ─────────────────
    op.alter_column('product_variants', 'price', new_column_name='price_usd')
    op.add_column('product_variants', sa.Column('price_ars', sa.Numeric(precision=12, scale=2), nullable=True))
    op.alter_column('product_variants', 'price_usd', nullable=True)
    op.drop_constraint(op.f('ck_variant_price_non_negative'), 'product_variants', type_='check')
    op.create_check_constraint('ck_variant_price_usd_non_negative', 'product_variants', 'price_usd >= 0')
    op.create_check_constraint('ck_variant_price_ars_non_negative', 'product_variants', 'price_ars >= 0')
    op.create_check_constraint(
        'ck_variant_price_at_least_one', 'product_variants',
        'price_usd IS NOT NULL OR price_ars IS NOT NULL',
    )

    # ── supply_variants: price -> price_usd (+ price_ars) ───────────────────
    op.alter_column('supply_variants', 'price', new_column_name='price_usd')
    op.add_column('supply_variants', sa.Column('price_ars', sa.Numeric(precision=12, scale=2), nullable=True))
    op.alter_column('supply_variants', 'price_usd', nullable=True)
    op.drop_constraint(op.f('ck_supply_variant_price_non_negative'), 'supply_variants', type_='check')
    op.create_check_constraint('ck_supply_variant_price_usd_non_negative', 'supply_variants', 'price_usd >= 0')
    op.create_check_constraint('ck_supply_variant_price_ars_non_negative', 'supply_variants', 'price_ars >= 0')
    op.create_check_constraint(
        'ck_supply_variant_price_at_least_one', 'supply_variants',
        'price_usd IS NOT NULL OR price_ars IS NOT NULL',
    )

    # ── packages: pricing_value -> pricing_value_usd (+ pricing_value_ars,
    #    discount_percent) ───────────────────────────────────────────────────
    op.add_column('packages', sa.Column('discount_percent', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('packages', sa.Column('pricing_value_ars', sa.Numeric(precision=12, scale=2), nullable=True))
    op.alter_column('packages', 'pricing_value', new_column_name='pricing_value_usd')
    op.alter_column('packages', 'pricing_value_usd', nullable=True)
    op.drop_constraint(op.f('ck_package_pricing_value_positive'), 'packages', type_='check')

    # discount_percent-mode rows had a 0-100 PERCENT in pricing_value_usd,
    # not a dollar amount — move it to its own column and clear the
    # currency-value column so it doesn't get misread as a USD price.
    op.execute(
        """
        UPDATE packages
        SET discount_percent = pricing_value_usd,
            pricing_value_usd = NULL
        WHERE pricing_mode = 'discount_percent'
        """
    )

    op.create_check_constraint(
        'ck_package_pricing_mode_matches_values', 'packages',
        "(pricing_mode = 'discount_percent' AND discount_percent IS NOT NULL "
        "AND discount_percent > 0 AND discount_percent < 100 "
        "AND pricing_value_ars IS NULL AND pricing_value_usd IS NULL) "
        "OR "
        "(pricing_mode = 'final_price' AND discount_percent IS NULL "
        "AND (pricing_value_ars IS NOT NULL OR pricing_value_usd IS NOT NULL) "
        "AND (pricing_value_ars IS NULL OR pricing_value_ars > 0) "
        "AND (pricing_value_usd IS NULL OR pricing_value_usd > 0))",
    )

    # ── quotes.currency — NOT NULL from the start via server_default, which
    #    backfills every existing row in place (PG11+ metadata-only add),
    #    then the server_default is dropped so new rows must say so
    #    explicitly (the ORM/schema layer always supplies it going forward).
    currency_enum = sa.Enum('ARS', 'USD', name='currency')
    currency_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'quotes',
        sa.Column('currency', currency_enum, nullable=False, server_default='USD'),
    )
    op.alter_column('quotes', 'currency', server_default=None)

    # ── settings: hourly_rate -> hourly_rate_usd (value kept). No
    #    hourly_rate_ars row is inserted — AppSettingRepository.get_value
    #    already returns None for a missing key and QuoteService.get_hourly_rate
    #    already falls back to Decimal("0") for that, so this is a no-op
    #    behavior change for ARS servicios quotes until an admin sets it.
    op.execute(
        """
        INSERT INTO app_settings (key, value)
        SELECT 'hourly_rate_usd', value FROM app_settings WHERE key = 'hourly_rate'
        ON CONFLICT (key) DO NOTHING
        """
    )
    op.execute("DELETE FROM app_settings WHERE key = 'hourly_rate'")


def downgrade() -> None:
    # ── settings: hourly_rate_usd -> hourly_rate (ARS value, if any, is lost
    #    — the pre-migration schema had no room for it). ────────────────────
    op.execute(
        """
        INSERT INTO app_settings (key, value)
        SELECT 'hourly_rate', value FROM app_settings WHERE key = 'hourly_rate_usd'
        ON CONFLICT (key) DO NOTHING
        """
    )
    op.execute("DELETE FROM app_settings WHERE key IN ('hourly_rate_usd', 'hourly_rate_ars')")

    # ── quotes.currency ──────────────────────────────────────────────────
    op.drop_column('quotes', 'currency')
    sa.Enum(name='currency').drop(op.get_bind(), checkfirst=True)

    # ── packages: fold discount_percent / pricing_value_ars back into a
    #    single NOT NULL pricing_value (percent for discount_percent mode,
    #    USD-preferred amount for final_price mode — ARS-only final prices
    #    are lossily collapsed onto pricing_value here, same caveat as the
    #    variant price columns below). The mode-matching check is dropped
    #    FIRST — it forbids pricing_value_usd and discount_percent from being
    #    non-NULL at the same time, which the first UPDATE below briefly is. ─
    op.drop_constraint('ck_package_pricing_mode_matches_values', 'packages', type_='check')
    op.execute(
        """
        UPDATE packages
        SET pricing_value_usd = discount_percent
        WHERE pricing_mode = 'discount_percent'
        """
    )
    op.execute(
        """
        UPDATE packages
        SET pricing_value_usd = COALESCE(pricing_value_usd, pricing_value_ars, 0)
        WHERE pricing_mode = 'final_price'
        """
    )
    op.alter_column('packages', 'pricing_value_usd', new_column_name='pricing_value', nullable=False)
    op.create_check_constraint(op.f('ck_package_pricing_value_positive'), 'packages', 'pricing_value > 0')
    op.drop_column('packages', 'pricing_value_ars')
    op.drop_column('packages', 'discount_percent')

    # ── supply_variants: price_usd -> price (ARS-only variants lossily fall
    #    back to price_ars so the restored NOT NULL column is never empty). ──
    op.execute("UPDATE supply_variants SET price_usd = COALESCE(price_usd, price_ars, 0)")
    op.drop_constraint('ck_supply_variant_price_at_least_one', 'supply_variants', type_='check')
    op.drop_constraint('ck_supply_variant_price_ars_non_negative', 'supply_variants', type_='check')
    op.drop_constraint('ck_supply_variant_price_usd_non_negative', 'supply_variants', type_='check')
    op.drop_column('supply_variants', 'price_ars')
    op.alter_column('supply_variants', 'price_usd', new_column_name='price', nullable=False)
    op.create_check_constraint(op.f('ck_supply_variant_price_non_negative'), 'supply_variants', 'price >= 0')

    # ── product_variants: price_usd -> price (same ARS-only caveat) ────────
    op.execute("UPDATE product_variants SET price_usd = COALESCE(price_usd, price_ars, 0)")
    op.drop_constraint('ck_variant_price_at_least_one', 'product_variants', type_='check')
    op.drop_constraint('ck_variant_price_ars_non_negative', 'product_variants', type_='check')
    op.drop_constraint('ck_variant_price_usd_non_negative', 'product_variants', type_='check')
    op.drop_column('product_variants', 'price_ars')
    op.alter_column('product_variants', 'price_usd', new_column_name='price', nullable=False)
    op.create_check_constraint(op.f('ck_variant_price_non_negative'), 'product_variants', 'price >= 0')
