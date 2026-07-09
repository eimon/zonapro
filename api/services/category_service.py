import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.category_repository import CategoryRepository
from schemas.category import CategoryCreate, CategoryUpdate
from models.category import Category
from exceptions.general import NotFoundException, ConflictException


class CategoryService:
    def __init__(self, db: AsyncSession):
        self.repo = CategoryRepository(db)

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[Category]:
        return await self.repo.get_all(skip=skip, limit=limit)

    async def get_by_id(self, id: uuid.UUID) -> Category:
        obj = await self.repo.get_by_id(id)
        if not obj or obj.deleted_at is not None:
            raise NotFoundException("Categoría no encontrada")
        return obj

    async def create(self, data: CategoryCreate) -> Category:
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictException("Ya existe una categoría con ese slug")
        return await self.repo.create(
            name=data.name,
            slug=data.slug,
            description=data.description,
        )

    async def update(self, id: uuid.UUID, data: CategoryUpdate) -> Category:
        obj = await self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)
        if "slug" in update_data and update_data["slug"] != obj.slug:
            existing = await self.repo.get_by_slug(update_data["slug"])
            if existing:
                raise ConflictException("Ya existe una categoría con ese slug")
        return await self.repo.update(obj, **update_data)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self.get_by_id(id)
        result = await self.repo.soft_delete(obj.id)
        if not result:
            raise NotFoundException("Categoría no encontrada")
