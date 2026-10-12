import uuid
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.ext.asyncio import AsyncSession
from core.package_pricing import (
    package_list_price_net,
    package_list_price_gross,
    compute_final_price_and_discount,
    compute_final_price_gross,
    package_is_available_in_currency,
    item_variant,
    item_parent,
    item_unit_price_net,
    item_unit_price_gross,
    item_line_total_net,
    item_line_total_gross,
)
from repositories.package_repository import PackageRepository
from repositories.product_repository import ProductVariantRepository
from repositories.supply_repository import SupplyVariantRepository
from schemas.package import PackageCreate, PackageUpdate, PackageItemCreate, PackagePriceInfo
from models.package import Package
from models.enums import PackageItemKind, PackagePricingMode, IvaRate, Currency
from exceptions.general import NotFoundException, ConflictException, BadRequestException

TWO_PLACES = Decimal("0.01")
_PRICE_FIELD = {Currency.ARS: "price_ars", Currency.USD: "price_usd"}


def _attach_computed(package: Package) -> Package:
    """Attaches read-time-only, non-persisted attributes the response
    schema needs — pricing is always derived from live catalog prices,
    never snapshotted (the admin's chosen mode+value(s) stay fixed, but the
    numbers they produce move with the catalog), computed independently for
    each currency."""
    prices: dict[Currency, PackagePriceInfo | None] = {}
    for currency in Currency:
        if not package_is_available_in_currency(package, currency):
            prices[currency] = None
            continue
        list_price_net = package_list_price_net(package, currency)
        list_price_gross = package_list_price_gross(package, currency)
        pricing_value = package.pricing_value_ars if currency == Currency.ARS else package.pricing_value_usd
        result = compute_final_price_and_discount(
            list_price_net, package.pricing_mode, package.discount_percent, pricing_value
        )
        if result is None:
            prices[currency] = None
            continue
        final_price_net, discount_percent = result
        final_price_gross = compute_final_price_gross(list_price_net, list_price_gross, final_price_net)
        prices[currency] = PackagePriceInfo(
            list_price=list_price_gross,
            list_price_net=list_price_net,
            final_price=final_price_gross,
            final_price_net=final_price_net,
            discount_percent=discount_percent,
        )

    package.prices = prices
    package.is_available = any(v is not None for v in prices.values())

    for item in package.items:
        variant = item_variant(item)
        parent = item_parent(item)
        item.name = f"{parent.name} — {variant.name}" if parent and variant else (variant.name if variant else "")
        item.sku = variant.sku if variant else ""
        item.iva_rate = parent.iva_rate if parent else IvaRate.iva_21
        item.unit_price_net_ars = item_unit_price_net(item, Currency.ARS)
        item.unit_price_ars = item_unit_price_gross(item, Currency.ARS)
        item.line_total_net_ars = item_line_total_net(item, Currency.ARS)
        item.line_total_ars = item_line_total_gross(item, Currency.ARS)
        item.unit_price_net_usd = item_unit_price_net(item, Currency.USD)
        item.unit_price_usd = item_unit_price_gross(item, Currency.USD)
        item.line_total_net_usd = item_line_total_net(item, Currency.USD)
        item.line_total_usd = item_line_total_gross(item, Currency.USD)
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

    async def _resolve_items(self, items_data: list[PackageItemCreate]) -> tuple[list[dict], list[tuple]]:
        if not items_data:
            raise BadRequestException("El paquete debe tener al menos un ítem")
        resolved: list[dict] = []
        variants: list[tuple] = []
        for item_data in items_data:
            variant = await self._resolve_item(item_data)
            variants.append((variant, item_data.quantity))
            resolved.append(
                {
                    "kind": item_data.kind,
                    "display_order": item_data.display_order,
                    "product_variant_id": item_data.product_variant_id,
                    "supply_variant_id": item_data.supply_variant_id,
                    "quantity": item_data.quantity,
                }
            )
        return resolved, variants

    def _list_price_net(self, variants: list[tuple], currency: Currency) -> Decimal | None:
        """Sum of (variant price in `currency` * quantity) across `variants`
        — None if any variant lacks a price in that currency (mirrors
        core.package_pricing.package_has_all_items_priced, but works from raw
        (variant, quantity) pairs instead of persisted PackageItem rows, since
        this runs before create/update writes them)."""
        total = Decimal("0.00")
        for variant, qty in variants:
            price = getattr(variant, _PRICE_FIELD[currency])
            if price is None:
                return None
            total += (price * qty).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        return total

    def _validate_pricing(
        self,
        pricing_mode: PackagePricingMode,
        discount_percent: Decimal | None,
        pricing_value_ars: Decimal | None,
        pricing_value_usd: Decimal | None,
        variants: list[tuple],
    ) -> None:
        if pricing_mode == PackagePricingMode.discount_percent:
            if discount_percent is None:
                raise BadRequestException("Debés indicar un porcentaje de descuento")
            if not (Decimal("0") < discount_percent < Decimal("100")):
                raise BadRequestException("El porcentaje de descuento debe ser mayor a 0 y menor a 100")
            return

        if pricing_value_ars is None and pricing_value_usd is None:
            raise BadRequestException("Debés indicar un precio final para al menos una moneda")

        for currency, value in ((Currency.ARS, pricing_value_ars), (Currency.USD, pricing_value_usd)):
            if value is None:
                continue
            if value <= 0:
                raise BadRequestException(f"El precio final en {currency.value} debe ser mayor a 0")
            list_price_net = self._list_price_net(variants, currency)
            if list_price_net is None:
                raise BadRequestException(
                    f"Todos los ítems deben tener precio en {currency.value} para fijar "
                    f"un precio final en {currency.value}"
                )
            if value >= list_price_net:
                raise BadRequestException(f"El precio final en {currency.value} debe ser menor al precio de lista")

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

        resolved, variants = await self._resolve_items(data.items)
        discount_percent = data.discount_percent if data.pricing_mode == PackagePricingMode.discount_percent else None
        pricing_value_ars = data.pricing_value_ars if data.pricing_mode == PackagePricingMode.final_price else None
        pricing_value_usd = data.pricing_value_usd if data.pricing_mode == PackagePricingMode.final_price else None
        self._validate_pricing(data.pricing_mode, discount_percent, pricing_value_ars, pricing_value_usd, variants)

        package = await self.repo.create(
            name=data.name,
            slug=data.slug,
            description=data.description,
            pricing_mode=data.pricing_mode,
            discount_percent=discount_percent,
            pricing_value_ars=pricing_value_ars,
            pricing_value_usd=pricing_value_usd,
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

        # Normalize the pricing triple so the two shapes (discount_percent vs.
        # final_price_ars/usd) never coexist in the DB — switching modes (or
        # simply not providing a field for the active mode) always clears the
        # fields that don't apply to the resulting mode.
        requested_mode = update_data.get("pricing_mode", obj.pricing_mode)
        mode_changed = requested_mode != obj.pricing_mode
        if requested_mode == PackagePricingMode.discount_percent:
            discount_percent = update_data.get("discount_percent", None if mode_changed else obj.discount_percent)
            pricing_value_ars = None
            pricing_value_usd = None
        else:
            discount_percent = None
            pricing_value_ars = update_data.get(
                "pricing_value_ars", None if mode_changed else obj.pricing_value_ars
            )
            pricing_value_usd = update_data.get(
                "pricing_value_usd", None if mode_changed else obj.pricing_value_usd
            )
        update_data["pricing_mode"] = requested_mode
        update_data["discount_percent"] = discount_percent
        update_data["pricing_value_ars"] = pricing_value_ars
        update_data["pricing_value_usd"] = pricing_value_usd

        if data.items is not None:
            resolved, variants = await self._resolve_items(data.items)
            self._validate_pricing(requested_mode, discount_percent, pricing_value_ars, pricing_value_usd, variants)
            await self.repo.update(obj, **update_data)
            await self.repo.replace_items(obj, resolved)
        else:
            if not obj.items:
                raise BadRequestException("El paquete debe tener al menos un ítem")
            variants = [(item_variant(item), item.quantity) for item in obj.items]
            self._validate_pricing(requested_mode, discount_percent, pricing_value_ars, pricing_value_usd, variants)
            await self.repo.update(obj, **update_data)

        return await self.get_by_id_admin(id)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self.repo.get_by_id(id)
        if not obj:
            raise NotFoundException("Paquete no encontrado")
        result = await self.repo.soft_delete(obj.id)
        if not result:
            raise NotFoundException("Paquete no encontrado")
