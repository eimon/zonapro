import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from core.package_pricing import (
    package_list_price_net,
    package_list_price_gross,
    compute_final_price_and_discount,
    compute_final_price_gross,
    package_is_available,
    item_unit_price_net,
    item_unit_price_gross,
    item_line_total_net,
    item_line_total_gross,
)
from repositories.package_repository import PackageRepository
from repositories.product_repository import ProductVariantRepository
from repositories.supply_repository import SupplyVariantRepository
from schemas.package import PackageCreate, PackageUpdate, PackageItemCreate
from models.package import Package
from models.enums import PackageItemKind, PackagePricingMode, IvaRate
from exceptions.general import NotFoundException, ConflictException, BadRequestException


def _attach_computed(package: Package) -> Package:
    """Attaches read-time-only, non-persisted attributes the response
    schema needs — pricing is always derived from live catalog prices,
    never snapshotted (D: admin's chosen mode+value stays fixed, but the
    numbers it produces move with the catalog)."""
    list_price_net = package_list_price_net(package)
    list_price_gross = package_list_price_gross(package)
    final_price_net, discount_percent = compute_final_price_and_discount(
        list_price_net, package.pricing_mode, package.pricing_value
    )
    final_price_gross = compute_final_price_gross(list_price_net, list_price_gross, final_price_net)
    package.list_price_net = list_price_net
    package.list_price = list_price_gross
    package.final_price_net = final_price_net
    package.final_price = final_price_gross
    package.discount_percent = discount_percent
    package.is_available = package_is_available(package)

    for item in package.items:
        variant = item.product_variant if item.kind == PackageItemKind.product else item.supply_variant
        parent = None
        if variant is not None:
            parent = variant.product if item.kind == PackageItemKind.product else variant.supply
        item.name = f"{parent.name} — {variant.name}" if parent and variant else (variant.name if variant else "")
        item.sku = variant.sku if variant else ""
        item.iva_rate = parent.iva_rate if parent else IvaRate.iva_21
        item.unit_price_net = item_unit_price_net(item)
        item.unit_price = item_unit_price_gross(item)
        item.line_total_net = item_line_total_net(item)
        item.line_total = item_line_total_gross(item)
        item.image_url = parent.image_url if parent else None
        item.category_slug = (
            parent.category.slug if item.kind == PackageItemKind.product and parent and parent.category else None
        )
        item.product_id = parent.id if item.kind == PackageItemKind.product and parent else None

    return package


class PackageService:
    def __init__(self, db: AsyncSession):
        self.repo = PackageRepository(db)
        self.variant_repo = ProductVariantRepository(db)
        self.supply_variant_repo = SupplyVariantRepository(db)

    async def _resolve_item(self, item_data: PackageItemCreate):
        if item_data.kind == PackageItemKind.product:
            variant = await self.variant_repo.get_with_product(item_data.product_variant_id)
            if not variant or variant.deleted_at is not None:
                raise NotFoundException("Variante de producto no encontrada")
            if not variant.product or variant.product.deleted_at is not None or not variant.product.is_active:
                raise BadRequestException(f"El producto de la variante '{variant.sku}' no está activo")
        else:
            variant = await self.supply_variant_repo.get_with_supply(item_data.supply_variant_id)
            if not variant or variant.deleted_at is not None:
                raise NotFoundException("Variante de insumo no encontrada")
            if not variant.supply or variant.supply.deleted_at is not None or not variant.supply.is_active:
                raise BadRequestException(f"El insumo de la variante '{variant.sku}' no está activo")
        return variant

    async def _resolve_items(self, items_data: list[PackageItemCreate]) -> tuple[list[dict], Decimal]:
        if not items_data:
            raise BadRequestException("El paquete debe tener al menos un ítem")
        resolved: list[dict] = []
        list_price = Decimal("0")
        for item_data in items_data:
            variant = await self._resolve_item(item_data)
            list_price += variant.price * item_data.quantity
            resolved.append(
                {
                    "kind": item_data.kind,
                    "display_order": item_data.display_order,
                    "product_variant_id": item_data.product_variant_id,
                    "supply_variant_id": item_data.supply_variant_id,
                    "quantity": item_data.quantity,
                }
            )
        return resolved, list_price

    def _validate_pricing(self, pricing_mode: PackagePricingMode, pricing_value: Decimal, list_price: Decimal) -> None:
        if pricing_mode == PackagePricingMode.discount_percent:
            if not (Decimal("0") < pricing_value < Decimal("100")):
                raise BadRequestException("El porcentaje de descuento debe ser mayor a 0 y menor a 100")
        else:
            if pricing_value <= 0:
                raise BadRequestException("El precio final debe ser mayor a 0")
            if pricing_value >= list_price:
                raise BadRequestException("El precio final debe ser menor al precio de lista")

    async def get_all_public(self) -> list[Package]:
        packages = await self.repo.get_all_with_items(only_active=True)
        computed = [_attach_computed(p) for p in packages]
        return [p for p in computed if p.is_available]

    async def get_all_admin(self) -> list[Package]:
        packages = await self.repo.get_all_with_items()
        return [_attach_computed(p) for p in packages]

    async def get_by_id_admin(self, id: uuid.UUID) -> Package:
        obj = await self.repo.get_with_items(id)
        if not obj:
            raise NotFoundException("Paquete no encontrado")
        return _attach_computed(obj)

    async def get_by_id_public(self, id: uuid.UUID) -> Package:
        obj = await self.repo.get_with_items(id)
        if not obj or not obj.is_active:
            raise NotFoundException("Paquete no encontrado")
        _attach_computed(obj)
        if not obj.is_available:
            raise NotFoundException("Paquete no encontrado")
        return obj

    async def create(self, data: PackageCreate) -> Package:
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictException("Ya existe un paquete con ese slug")

        resolved, list_price = await self._resolve_items(data.items)
        self._validate_pricing(data.pricing_mode, data.pricing_value, list_price)

        package = await self.repo.create(
            name=data.name,
            slug=data.slug,
            description=data.description,
            pricing_mode=data.pricing_mode,
            pricing_value=data.pricing_value,
            is_active=data.is_active,
        )
        for item in resolved:
            await self.repo.create_item(package_id=package.id, **item)

        return await self.get_by_id_admin(package.id)

    async def update(self, id: uuid.UUID, data: PackageUpdate) -> Package:
        obj = await self.repo.get_with_items(id)
        if not obj:
            raise NotFoundException("Paquete no encontrado")

        update_data = data.model_dump(exclude_unset=True, exclude={"items"})

        if "slug" in update_data and update_data["slug"] != obj.slug:
            existing = await self.repo.get_by_slug(update_data["slug"])
            if existing:
                raise ConflictException("Ya existe un paquete con ese slug")

        pricing_mode = update_data.get("pricing_mode", obj.pricing_mode)
        pricing_value = update_data.get("pricing_value", obj.pricing_value)

        if data.items is not None:
            resolved, list_price = await self._resolve_items(data.items)
            self._validate_pricing(pricing_mode, pricing_value, list_price)
            await self.repo.update(obj, **update_data)
            await self.repo.replace_items(obj, resolved)
        else:
            if not obj.items:
                raise BadRequestException("El paquete debe tener al menos un ítem")
            list_price = package_list_price_net(obj)
            self._validate_pricing(pricing_mode, pricing_value, list_price)
            await self.repo.update(obj, **update_data)

        return await self.get_by_id_admin(id)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self.repo.get_by_id(id)
        if not obj:
            raise NotFoundException("Paquete no encontrado")
        result = await self.repo.soft_delete(obj.id)
        if not result:
            raise NotFoundException("Paquete no encontrado")
