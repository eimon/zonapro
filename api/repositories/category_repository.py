from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.category import Category
from repositories.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    def __init__(self, db: AsyncSession):
        super().__init__(Category, db)

    async def get_by_slug(self, slug: str) -> Category | None:
        result = await self.db.execute(
            select(Category).where(Category.slug == slug, Category.deleted_at.is_(None))
        )
        return result.scalars().first()

    async def create(self, name: str, slug: str, description: str | None = None) -> Category:
        obj = Category(name=name, slug=slug, description=description)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: Category, **kwargs) -> Category:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj
