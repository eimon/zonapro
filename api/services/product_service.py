import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.product_repository import ProductRepository, ProductVariantRepository
from schemas.product import ProductCreate, ProductUpdate, ProductVariantCreate, ProductVariantUpdate
from models.product import Product, ProductVariant
from models.enums import IvaRate
from exceptions.general import NotFoundException, ConflictException, BadRequestException


def _to_net_price(price: Decimal, mode: str, iva_rate: IvaRate) -> Decimal:
    if mode == "net":
        return price
    rate = Decimal(iva_rate.value)
    return (price / (1 + rate / Decimal("100"))).quantize(Decimal("0.01"))


def _compute_final_price(price: Decimal, iva_rate: IvaRate) -> Decimal:
    rate = Decimal(iva_rate.value)
    return (price * (1 + rate / Decimal("100"))).quantize(Decimal("0.01"))


def _attach_variant_final_prices(product: Product) -> Product:
    for variant in product.variants:
        variant.final_price = _compute_final_price(variant.price, product.iva_rate)
    return product


class ProductService:
    def __init__(self, db: AsyncSession):
        self.repo = ProductRepository(db)
        self.variant_repo = ProductVariantRepository(db)

    async def _assert_sku_free(self, sku: str, exclude_id: uuid.UUID | None = None) -> None:
        clash = await self.variant_repo.get_by_sku(sku, exclude_id=exclude_id)
        if clash:
            raise ConflictException(
                f"El SKU '{sku}' ya pertenece al producto '{clash.product.slug}'"
            )

    async def get_all(
        self,
        category_id: uuid.UUID | None = None,
        made_to_order: bool | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Product]:
        products = await self.repo.get_all_with_variants(
            category_id=category_id,
            made_to_order=made_to_order,
            skip=skip,
            limit=limit,
        )
        return [_attach_variant_final_prices(p) for p in products]

    async def get_by_id(self, id: uuid.UUID) -> Product:
        obj = await self.repo.get_with_variants(id)
        if not obj:
            raise NotFoundException("Producto no encontrado")
        return _attach_variant_final_prices(obj)

    async def create(self, data: ProductCreate) -> Product:
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictException("Ya existe un producto con ese slug")

        seen_skus: set[str] = set()
        for variant_data in data.variants:
            if variant_data.sku in seen_skus:
                raise ConflictException(f"El SKU '{variant_data.sku}' está repetido en el mismo producto")
            seen_skus.add(variant_data.sku)
            await self._assert_sku_free(variant_data.sku)

        product = await self.repo.create(data)

        for variant_data in data.variants:
            variant_price = _to_net_price(variant_data.price, variant_data.price_input_mode, data.iva_rate)
            await self.variant_repo.create(product.id, variant_data, price=variant_price)

        # reload with variants
        reloaded = await self.repo.get_with_variants(product.id)
        return _attach_variant_final_prices(reloaded)

    async def update(self, id: uuid.UUID, data: ProductUpdate) -> Product:
        obj = await self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)
        if "slug" in update_data and update_data["slug"] != obj.slug:
            existing = await self.repo.get_by_slug(update_data["slug"])
            if existing:
                raise ConflictException("Ya existe un producto con ese slug")

        await self.repo.update(obj, **update_data)
        reloaded = await self.repo.get_with_variants(obj.id)
        return _attach_variant_final_prices(reloaded)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self.get_by_id(id)
        await self.variant_repo.soft_delete_all_for_product(obj.id)
        result = await self.repo.soft_delete(obj.id)
        if not result:
            raise NotFoundException("Producto no encontrado")

    async def create_variant(self, product_id: uuid.UUID, data: ProductVariantCreate) -> ProductVariant:
        product = await self.get_by_id(product_id)  # ensures product exists
        await self._assert_sku_free(data.sku)
        price = _to_net_price(data.price, data.price_input_mode, product.iva_rate)
        variant = await self.variant_repo.create(product_id, data, price=price)
        variant.final_price = _compute_final_price(variant.price, product.iva_rate)
        return variant

    async def update_variant(self, variant_id: uuid.UUID, data: ProductVariantUpdate) -> ProductVariant:
        obj = await self.variant_repo.get_by_id(variant_id)
        if not obj or obj.deleted_at is not None:
            raise NotFoundException("Variante no encontrada")
        update_data = data.model_dump(exclude_unset=True)
        if "stock_qty" in update_data and update_data["stock_qty"] < 0:
            raise BadRequestException("El stock no puede ser negativo")
        if "sku" in update_data and update_data["sku"] != obj.sku:
            await self._assert_sku_free(update_data["sku"], exclude_id=obj.id)

        product = await self.repo.get_by_id(obj.product_id)
        price_input_mode = update_data.pop("price_input_mode", "net")
        if "price" in update_data and update_data["price"] is not None:
            update_data["price"] = _to_net_price(update_data["price"], price_input_mode, product.iva_rate)

        variant = await self.variant_repo.update(obj, **update_data)
        variant.final_price = _compute_final_price(variant.price, product.iva_rate)
        return variant

    async def delete_variant(self, variant_id: uuid.UUID) -> None:
        variant = await self.variant_repo.get_by_id(variant_id)
        if not variant or variant.deleted_at is not None:
            raise NotFoundException("Variante no encontrada")

        active_count = await self.variant_repo.count_active_for_product(variant.product_id)
        if active_count <= 1:
            raise BadRequestException("No podés eliminar la única variante del producto")

        result = await self.variant_repo.hard_delete(variant_id)
        if not result:
            raise NotFoundException("Variante no encontrada")
