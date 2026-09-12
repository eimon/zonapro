from datetime import date, datetime
from sqlalchemy import Date, cast, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models.consultation import Consultation
from models.enums import ConsultationStatus, QuoteStatus, QuoteType
from models.product import Product, ProductVariant
from models.quote import Quote
from models.supply import Supply


class DashboardRepository:
    """Read-only aggregate queries for the admin dashboard. No writes."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def count_active_products(self) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Product)
            .where(Product.is_active.is_(True), Product.deleted_at.is_(None))
        )
        return result.scalar_one()

    async def count_active_supplies(self) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Supply)
            .where(Supply.is_active.is_(True), Supply.deleted_at.is_(None))
        )
        return result.scalar_one()

    async def count_quotes_by_status(self) -> list[tuple[QuoteStatus, int]]:
        # Both quote_type values combined — status applies to both flows.
        result = await self.db.execute(
            select(Quote.status, func.count())
            .where(Quote.deleted_at.is_(None))
            .group_by(Quote.status)
        )
        return list(result.all())

    async def count_quotes_per_day(self, since: datetime) -> list[tuple[date, QuoteType, int]]:
        day_col = cast(Quote.created_at, Date)
        result = await self.db.execute(
            select(day_col.label("day"), Quote.quote_type, func.count())
            .where(Quote.deleted_at.is_(None), Quote.created_at >= since)
            .group_by(day_col, Quote.quote_type)
        )
        return list(result.all())

    async def count_pending_consultations(self) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Consultation)
            .where(
                Consultation.status == ConsultationStatus.pendiente,
                Consultation.deleted_at.is_(None),
            )
        )
        return result.scalar_one()

    async def get_low_stock_variants(self, limit: int = 5) -> list[ProductVariant]:
        # Excludes variants whose parent product is made-to-order AND has
        # zero stock — that's normal (intentionally no stock), not "low
        # stock". A made-to-order product with real stock still counts.
        result = await self.db.execute(
            select(ProductVariant)
            .join(Product, ProductVariant.product_id == Product.id)
            .options(selectinload(ProductVariant.product))
            .where(
                ProductVariant.deleted_at.is_(None),
                Product.deleted_at.is_(None),
                Product.is_active.is_(True),
                or_(ProductVariant.stock_qty > 0, Product.made_to_order.is_(False)),
            )
            .order_by(ProductVariant.stock_qty.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_approved_product_quotes_with_items(self) -> list[Quote]:
        result = await self.db.execute(
            select(Quote)
            .options(selectinload(Quote.items))
            .where(
                Quote.deleted_at.is_(None),
                Quote.quote_type == QuoteType.productos,
                Quote.status == QuoteStatus.aprobada,
            )
        )
        return list(result.scalars().all())
