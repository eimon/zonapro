import uuid
from datetime import datetime, timezone
from sqlalchemy import func
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
            iva_rate=data.iva_rate,
            image_url=data.image_url,
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

    async def get_all_for_export(
        self,
        category_id: uuid.UUID | None = None,
        made_to_order: bool | None = None,
    ) -> list[Product]:
        query = (
            select(Product)
            .options(selectinload(Product.variants), selectinload(Product.category))
            .where(Product.deleted_at.is_(None))
            .order_by(Product.slug)
        )
        if category_id is not None:
            query = query.where(Product.category_id == category_id)
        if made_to_order is not None:
            query = query.where(Product.made_to_order == made_to_order)
        result = await self.db.execute(query)
        return list(result.scalars().all())


class ProductVariantRepository(BaseRepository[ProductVariant]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductVariant, db)

    async def create(self, product_id: uuid.UUID, data, price) -> ProductVariant:
        obj = ProductVariant(
            product_id=product_id,
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

    async def update(self, obj: ProductVariant, **kwargs) -> ProductVariant:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def count_active_for_product(self, product_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(ProductVariant)
            .where(ProductVariant.product_id == product_id, ProductVariant.deleted_at.is_(None))
        )
        return result.scalar_one()

    async def get_with_product(self, id: uuid.UUID) -> ProductVariant | None:
        result = await self.db.execute(
            select(ProductVariant)
            .options(selectinload(ProductVariant.product))
            .where(ProductVariant.id == id)
        )
        return result.scalars().first()

    async def get_by_sku(self, sku: str, exclude_id: uuid.UUID | None = None) -> ProductVariant | None:
        query = (
            select(ProductVariant)
            .options(selectinload(ProductVariant.product))
            .where(ProductVariant.sku == sku, ProductVariant.deleted_at.is_(None))
        )
        if exclude_id is not None:
            query = query.where(ProductVariant.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalars().first()

    async def soft_delete_all_for_product(self, product_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(ProductVariant).where(
                ProductVariant.product_id == product_id,
                ProductVariant.deleted_at.is_(None),
            )
        )
        rows = result.scalars().all()
        now = datetime.now(timezone.utc)
        for variant in rows:
            variant.deleted_at = now
        await self.db.flush()
        return len(rows)
