import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.package_repository import PackageRepository
from schemas.package import PackageCreate, PackageUpdate
from models.package import Package
from exceptions.general import NotFoundException, ConflictException


class PackageService:
    def __init__(self, db: AsyncSession):
        self.repo = PackageRepository(db)

    async def get_all(self) -> list[Package]:
        return await self.repo.get_all_with_groups()

    async def get_by_id(self, id: uuid.UUID) -> Package:
        obj = await self.repo.get_with_groups(id)
        if not obj:
            raise NotFoundException("Paquete no encontrado")
        return obj

    async def create(self, data: PackageCreate) -> Package:
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictException("Ya existe un paquete con ese slug")

        package = await self.repo.create(
            name=data.name,
            slug=data.slug,
            description=data.description,
            complexity=data.complexity,
            base_price=data.base_price,
            is_active=data.is_active,
        )

        for group_data in data.option_groups:
            group = await self.repo.create_option_group(
                package_id=package.id,
                name=group_data.name,
                display_order=group_data.display_order,
            )
            for option_data in group_data.options:
                await self.repo.create_option(
                    group_id=group.id,
                    label=option_data.label,
                    price_delta=option_data.price_delta,
                    is_default=option_data.is_default,
                    display_order=option_data.display_order,
                )

        # Reload with groups and options
        return await self.get_by_id(package.id)

    async def update(self, id: uuid.UUID, data: PackageUpdate) -> Package:
        obj = await self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)

        if "slug" in update_data and update_data["slug"] != obj.slug:
            existing = await self.repo.get_by_slug(update_data["slug"])
            if existing:
                raise ConflictException("Ya existe un paquete con ese slug")

        return await self.repo.update(obj, **update_data)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self.get_by_id(id)
        result = await self.repo.soft_delete(obj.id)
        if not result:
            raise NotFoundException("Paquete no encontrado")
