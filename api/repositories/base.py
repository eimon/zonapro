import uuid
from datetime import datetime, timezone
from typing import TypeVar, Generic, Type
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.database import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, model: Type[ModelT], db: AsyncSession):
        self.model = model
        self.db = db

    async def get_by_id(self, id: uuid.UUID) -> ModelT | None:
        result = await self.db.execute(select(self.model).where(self.model.id == id))
        return result.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[ModelT]:
        result = await self.db.execute(
            select(self.model)
            .where(self.model.deleted_at.is_(None))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def soft_delete(self, id: uuid.UUID) -> ModelT | None:
        obj = await self.get_by_id(id)
        if not obj:
            return None
        obj.deleted_at = datetime.now(timezone.utc)
        obj.is_active = False
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def hard_delete(self, id: uuid.UUID) -> bool:
        obj = await self.get_by_id(id)
        if not obj:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True
