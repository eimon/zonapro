import uuid
from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models.supply import Supply, SupplyVariant
from repositories.base import BaseRepository


class SupplyRepository(BaseRepository[Supply]):
    def __init__(self, db: AsyncSession):
        super().__init__(Supply, db)

    async def get_by_name(self, name: str) -> Supply | None:
        result = await self.db.execute(
            select(Supply).where(Supply.name == name, Supply.deleted_at.is_(None))
        )
        return result.scalars().first()

    async def get_with_variants(self, id: uuid.UUID) -> Supply | None:
        result = await self.db.execute(
            select(Supply)
            .options(selectinload(Supply.variants))
            .where(Supply.id == id, Supply.deleted_at.is_(None))
        )
        return result.scalars().first()

    async def get_all_with_variants(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Supply]:
        query = (
            select(Supply)
            .options(selectinload(Supply.variants))
            .where(Supply.deleted_at.is_(None), Supply.is_active.is_(True))
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, data) -> Supply:
        obj = Supply(
            name=data.name,
            description=data.description,
            iva_rate=data.iva_rate,
            is_active=data.is_active,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: Supply, **kwargs) -> Supply:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def get_all_for_export(self) -> list[Supply]:
        query = (
            select(Supply)
            .options(selectinload(Supply.variants))
            .where(Supply.deleted_at.is_(None))
            .order_by(Supply.name)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())


class SupplyVariantRepository(BaseRepository[SupplyVariant]):
    def __init__(self, db: AsyncSession):
        super().__init__(SupplyVariant, db)

    async def create(self, supply_id: uuid.UUID, data, price) -> SupplyVariant:
        obj = SupplyVariant(
            supply_id=supply_id,
            sku=data.sku,
            name=data.name,
            attributes=data.attributes,
            price=price,
            stock_qty=data.stock_qty,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: SupplyVariant, **kwargs) -> SupplyVariant:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def count_active_for_supply(self, supply_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(SupplyVariant)
            .where(SupplyVariant.supply_id == supply_id, SupplyVariant.deleted_at.is_(None))
        )
        return result.scalar_one()

    async def get_with_supply(self, id: uuid.UUID) -> SupplyVariant | None:
        result = await self.db.execute(
            select(SupplyVariant)
            .options(selectinload(SupplyVariant.supply))
            .where(SupplyVariant.id == id)
        )
        return result.scalars().first()

    async def get_by_sku(self, sku: str, exclude_id: uuid.UUID | None = None) -> SupplyVariant | None:
        query = (
            select(SupplyVariant)
            .options(selectinload(SupplyVariant.supply))
            .where(SupplyVariant.sku == sku, SupplyVariant.deleted_at.is_(None))
        )
        if exclude_id is not None:
            query = query.where(SupplyVariant.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalars().first()

    async def soft_delete_all_for_supply(self, supply_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(SupplyVariant).where(
                SupplyVariant.supply_id == supply_id,
                SupplyVariant.deleted_at.is_(None),
            )
        )
        rows = result.scalars().all()
        now = datetime.now(timezone.utc)
        for variant in rows:
            variant.deleted_at = now
        await self.db.flush()
        return len(rows)
