import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.product_repository import ProductRepository, ProductVariantRepository
from schemas.product import ProductCreate, ProductUpdate, ProductVariantCreate, ProductVariantUpdate
from models.product import Product, ProductVariant
from exceptions.general import NotFoundException, ConflictException, BadRequestException


class ProductService:
    def __init__(self, db: AsyncSession):
        self.repo = ProductRepository(db)
        self.variant_repo = ProductVariantRepository(db)

    async def get_all(
        self,
        category_id: uuid.UUID | None = None,
        made_to_order: bool | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Product]:
        return await self.repo.get_all_with_variants(
            category_id=category_id,
            made_to_order=made_to_order,
            skip=skip,
            limit=limit,
        )

    async def get_by_id(self, id: uuid.UUID) -> Product:
        obj = await self.repo.get_with_variants(id)
        if not obj:
            raise NotFoundException("Producto no encontrado")
        return obj

    async def create(self, data: ProductCreate) -> Product:
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictException("Ya existe un producto con ese slug")
        product = await self.repo.create(data)
        for variant_data in data.variants:
            await self.variant_repo.create(product.id, variant_data)
        # reload with variants
        return await self.repo.get_with_variants(product.id)

    async def update(self, id: uuid.UUID, data: ProductUpdate) -> Product:
        obj = await self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)
        if "slug" in update_data and update_data["slug"] != obj.slug:
            existing = await self.repo.get_by_slug(update_data["slug"])
            if existing:
                raise ConflictException("Ya existe un producto con ese slug")
        await self.repo.update(obj, **update_data)
        return await self.repo.get_with_variants(obj.id)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self.get_by_id(id)
        result = await self.repo.soft_delete(obj.id)
        if not result:
            raise NotFoundException("Producto no encontrado")

    async def create_variant(self, product_id: uuid.UUID, data: ProductVariantCreate) -> ProductVariant:
        await self.get_by_id(product_id)  # ensures product exists
        return await self.variant_repo.create(product_id, data)

    async def update_variant(self, variant_id: uuid.UUID, data: ProductVariantUpdate) -> ProductVariant:
        obj = await self.variant_repo.get_by_id(variant_id)
        if not obj or obj.deleted_at is not None:
            raise NotFoundException("Variante no encontrada")
        update_data = data.model_dump(exclude_unset=True)
        if "stock_qty" in update_data and update_data["stock_qty"] < 0:
            raise BadRequestException("El stock no puede ser negativo")
        return await self.variant_repo.update(obj, **update_data)

    async def delete_variant(self, variant_id: uuid.UUID) -> None:
        result = await self.variant_repo.hard_delete(variant_id)
        if not result:
            raise NotFoundException("Variante no encontrada")
