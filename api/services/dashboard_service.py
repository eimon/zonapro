from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from core.pricing import quote_total
from repositories.dashboard_repository import DashboardRepository
from schemas.dashboard import DashboardStats, LowStockVariant, QuotesByStatus, QuotesPerDay

DAYS_WINDOW = 30


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.repo = DashboardRepository(db)

    async def get_stats(self) -> DashboardStats:
        active_products = await self.repo.count_active_products()
        active_supplies = await self.repo.count_active_supplies()
        status_rows = await self.repo.count_quotes_by_status()
        pending_consultations = await self.repo.count_pending_consultations()
        low_stock_rows = await self.repo.get_low_stock_variants(limit=5)
        approved_quotes = await self.repo.get_approved_product_quotes_with_items()

        since = datetime.now(timezone.utc) - timedelta(days=DAYS_WINDOW - 1)
        per_day_rows = await self.repo.count_quotes_per_day(since)

        return DashboardStats(
            active_products=active_products,
            active_supplies=active_supplies,
            approved_quotes_count=len(approved_quotes),
            approved_quotes_value=sum(
                (quote_total(q) for q in approved_quotes), Decimal("0")
            ),
            pending_consultations=pending_consultations,
            quotes_by_status=[
                QuotesByStatus(status=status, count=count) for status, count in status_rows
            ],
            quotes_last_30_days=self._zero_fill(per_day_rows),
            low_stock_variants=[
                LowStockVariant(
                    variant_id=v.id,
                    product_id=v.product_id,
                    product_name=v.product.name if v.product else "",
                    sku=v.sku,
                    stock_qty=v.stock_qty,
                )
                for v in low_stock_rows
            ],
        )

    def _zero_fill(self, rows: list[tuple[date, object, int]]) -> list[QuotesPerDay]:
        today = datetime.now(timezone.utc).date()
        days = [today - timedelta(days=i) for i in range(DAYS_WINDOW - 1, -1, -1)]
        counts: dict[date, dict[str, int]] = {
            d: {"productos": 0, "servicios": 0} for d in days
        }
        for day, quote_type, count in rows:
            if day not in counts:
                continue
            key = quote_type.value if hasattr(quote_type, "value") else quote_type
            if key in counts[day]:
                counts[day][key] += count

        return [
            QuotesPerDay(date=d, productos=counts[d]["productos"], servicios=counts[d]["servicios"])
            for d in days
        ]
