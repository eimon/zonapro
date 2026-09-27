import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models.package import Package, PackageItem
from models.product import Product, ProductVariant
from models.supply import SupplyVariant
from models.enums import PackageItemKind
from repositories.base import BaseRepository


def _item_loaders():
    # Both branches are always attached (regardless of kind) — selectinload
    # is a no-op for the FK that's NULL on a given row.
    return (
        selectinload(Package.items)
        .selectinload(PackageItem.product_variant)
        .selectinload(ProductVariant.product)
        .selectinload(Product.category),
        selectinload(Package.items).selectinload(PackageItem.supply_variant).selectinload(SupplyVariant.supply),
    )


class PackageRepository(BaseRepository[Package]):
    def __init__(self, db: AsyncSession):
        super().__init__(Package, db)

    async def get_by_slug(self, slug: str) -> Package | None:
        result = await self.db.execute(
            select(Package).where(Package.slug == slug, Package.deleted_at.is_(None))
        )
        return result.scalars().first()

    async def get_with_items(self, id: uuid.UUID) -> Package | None:
        result = await self.db.execute(
            select(Package)
            .where(Package.id == id, Package.deleted_at.is_(None))
            .options(*_item_loaders())
        )
        return result.scalars().first()

    async def get_all_with_items(self, only_active: bool = False) -> list[Package]:
        query = select(Package).where(Package.deleted_at.is_(None)).options(*_item_loaders())
        if only_active:
            query = query.where(Package.is_active.is_(True))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(
        self,
        name: str,
        slug: str,
        description: str | None,
        pricing_mode,
        pricing_value: Decimal,
        is_active: bool,
    ) -> Package:
        obj = Package(
            name=name,
            slug=slug,
            description=description,
            pricing_mode=pricing_mode,
            pricing_value=pricing_value,
            is_active=is_active,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def create_item(
        self,
        package_id: uuid.UUID,
        kind: PackageItemKind,
        display_order: int,
        product_variant_id: uuid.UUID | None,
        supply_variant_id: uuid.UUID | None,
        quantity: Decimal,
    ) -> PackageItem:
        item = PackageItem(
            package_id=package_id,
            kind=kind,
            display_order=display_order,
            product_variant_id=product_variant_id,
            supply_variant_id=supply_variant_id,
            quantity=quantity,
        )
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def replace_items(self, package: Package, items_data: list[dict]) -> None:
        """Delete-all + re-create — the service already validated every new
        item, so this stays a dumb wholesale swap."""
        for item in list(package.items):
            await self.db.delete(item)
        await self.db.flush()
        for data in items_data:
            await self.create_item(package_id=package.id, **data)

    async def update(self, obj: Package, **kwargs) -> Package:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj
