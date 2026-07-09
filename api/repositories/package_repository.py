import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models.package import Package, PackageOptionGroup, PackageOption
from repositories.base import BaseRepository


class PackageRepository(BaseRepository[Package]):
    def __init__(self, db: AsyncSession):
        super().__init__(Package, db)

    async def get_by_slug(self, slug: str) -> Package | None:
        result = await self.db.execute(
            select(Package).where(Package.slug == slug, Package.deleted_at.is_(None))
        )
        return result.scalars().first()

    async def get_with_groups(self, id: uuid.UUID) -> Package | None:
        result = await self.db.execute(
            select(Package)
            .where(Package.id == id, Package.deleted_at.is_(None))
            .options(
                selectinload(Package.option_groups).selectinload(PackageOptionGroup.options)
            )
        )
        return result.scalars().first()

    async def get_all_with_groups(self) -> list[Package]:
        result = await self.db.execute(
            select(Package)
            .where(Package.deleted_at.is_(None))
            .options(
                selectinload(Package.option_groups).selectinload(PackageOptionGroup.options)
            )
        )
        return list(result.scalars().all())

    async def create(
        self,
        name: str,
        slug: str,
        description: str | None,
        complexity,
        base_price,
        is_active: bool,
    ) -> Package:
        obj = Package(
            name=name,
            slug=slug,
            description=description,
            complexity=complexity,
            base_price=base_price,
            is_active=is_active,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def create_option_group(
        self,
        package_id: uuid.UUID,
        name: str,
        display_order: int,
    ) -> PackageOptionGroup:
        group = PackageOptionGroup(
            package_id=package_id,
            name=name,
            display_order=display_order,
        )
        self.db.add(group)
        await self.db.flush()
        await self.db.refresh(group)
        return group

    async def create_option(
        self,
        group_id: uuid.UUID,
        label: str,
        price_delta,
        is_default: bool,
        display_order: int,
    ) -> PackageOption:
        option = PackageOption(
            group_id=group_id,
            label=label,
            price_delta=price_delta,
            is_default=is_default,
            display_order=display_order,
        )
        self.db.add(option)
        await self.db.flush()
        await self.db.refresh(option)
        return option

    async def update(self, obj: Package, **kwargs) -> Package:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj
