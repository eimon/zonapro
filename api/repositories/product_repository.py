import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models.product import Product, ProductVariant
from repositories.base import BaseRepository


class ProductRepository(BaseRepository[Product]):
    def __init__(self, db: AsyncSession):
        super().__init__(Product, db)

    async def get_by_slug(self, slug: str) -> Product | None:
        result = await self.db.execute(
            select(Product).where(Product.slug == slug, Product.deleted_at.is_(None))
        )
        return result.scalars().first()

    async def get_with_variants(self, id: uuid.UUID) -> Product | None:
        result = await self.db.execute(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.id == id, Product.deleted_at.is_(None))
        )
        return result.scalars().first()

    async def get_all_with_variants(
        self,
        category_id: uuid.UUID | None = None,
        made_to_order: bool | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Product]:
        query = (
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.deleted_at.is_(None), Product.is_active.is_(True))
        )
        if category_id is not None:
            query = query.where(Product.category_id == category_id)
        if made_to_order is not None:
            query = query.where(Product.made_to_order == made_to_order)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, data) -> Product:
        from schemas.product import ProductCreate
        obj = Product(
            name=data.name,
            slug=data.slug,
            description=data.description,
            base_price=data.base_price,
            made_to_order=data.made_to_order,
            category_id=data.category_id,
            is_active=data.is_active,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: Product, **kwargs) -> Product:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj


class ProductVariantRepository(BaseRepository[ProductVariant]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductVariant, db)

    async def create(self, product_id: uuid.UUID, data) -> ProductVariant:
        obj = ProductVariant(
            product_id=product_id,
            sku=data.sku,
            name=data.name,
            attributes=data.attributes,
            price=data.price,
            stock_qty=data.stock_qty,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: ProductVariant, **kwargs) -> ProductVariant:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj
