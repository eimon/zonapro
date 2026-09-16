import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models.enums import QuoteType
from models.quote import Quote, QuoteItem
from repositories.base import BaseRepository


class QuoteRepository(BaseRepository[Quote]):
    def __init__(self, db: AsyncSession):
        super().__init__(Quote, db)

    async def get_with_items(self, id: uuid.UUID) -> Quote | None:
        result = await self.db.execute(
            select(Quote)
            .where(Quote.id == id, Quote.deleted_at.is_(None))
            .options(
                selectinload(Quote.items).selectinload(QuoteItem.variant),
                selectinload(Quote.consultation),
                selectinload(Quote.created_by),
                selectinload(Quote.updated_by),
            )
        )
        return result.scalars().first()

    async def get_all_for_user(
        self, user_id: uuid.UUID, quote_type: QuoteType = QuoteType.productos
    ) -> list[Quote]:
        result = await self.db.execute(
            select(Quote)
            .where(
                Quote.created_by_id == user_id,
                Quote.deleted_at.is_(None),
                Quote.quote_type == quote_type,
            )
            .options(selectinload(Quote.items), selectinload(Quote.updated_by))
            .order_by(Quote.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_all_ordered(
        self, quote_type: QuoteType = QuoteType.productos
    ) -> list[Quote]:
        result = await self.db.execute(
            select(Quote)
            .where(Quote.deleted_at.is_(None), Quote.quote_type == quote_type)
            .options(selectinload(Quote.items), selectinload(Quote.updated_by))
            .order_by(Quote.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_quote(
        self,
        title: str,
        client_name: str,
        client_email: str,
        created_by_id: uuid.UUID,
        quote_type: QuoteType = QuoteType.productos,
        client_phone: str | None = None,
        validity_days: int = 30,
        notes: str | None = None,
        consultation_id: uuid.UUID | None = None,
        installation_cost_type=None,
        installation_cost_value: Decimal | None = None,
        contempla_iva: bool = True,
        cost_notes: str | None = None,
        margin_notes: str | None = None,
        internal_comments: str | None = None,
    ) -> Quote:
        obj = Quote(
            quote_type=quote_type,
            title=title,
            client_name=client_name,
            client_email=client_email,
            client_phone=client_phone,
            validity_days=validity_days,
            notes=notes,
            consultation_id=consultation_id,
            created_by_id=created_by_id,
            installation_cost_type=installation_cost_type,
            installation_cost_value=installation_cost_value,
            contempla_iva=contempla_iva,
            cost_notes=cost_notes,
            margin_notes=margin_notes,
            internal_comments=internal_comments,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def create_item(
        self,
        quote_id: uuid.UUID,
        kind,
        unit_price: Decimal,
        subtotal: Decimal,
        display_order: int = 0,
        product_variant_id: uuid.UUID | None = None,
        product_name_snapshot: str | None = None,
        product_sku_snapshot: str | None = None,
        supply_variant_id: uuid.UUID | None = None,
        supply_name_snapshot: str | None = None,
        supply_sku_snapshot: str | None = None,
        service_description: str | None = None,
        hours: Decimal | None = None,
        hourly_rate_snapshot: Decimal | None = None,
        quantity: int = 1,
        iva_rate: Decimal = Decimal("0"),
    ) -> QuoteItem:
        obj = QuoteItem(
            quote_id=quote_id,
            kind=kind,
            display_order=display_order,
            product_variant_id=product_variant_id,
            product_name_snapshot=product_name_snapshot,
            product_sku_snapshot=product_sku_snapshot,
            supply_variant_id=supply_variant_id,
            supply_name_snapshot=supply_name_snapshot,
            supply_sku_snapshot=supply_sku_snapshot,
            service_description=service_description,
            hours=hours,
            hourly_rate_snapshot=hourly_rate_snapshot,
            quantity=quantity,
            unit_price=unit_price,
            subtotal=subtotal,
            iva_rate=iva_rate,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def get_item(self, item_id: uuid.UUID) -> QuoteItem | None:
        result = await self.db.execute(
            select(QuoteItem).where(QuoteItem.id == item_id)
        )
        return result.scalars().first()

    async def update_quote(self, obj: Quote, **kwargs) -> Quote:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update_item(self, obj: QuoteItem, **kwargs) -> QuoteItem:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj
