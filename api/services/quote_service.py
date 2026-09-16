import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from core.pricing import quote_total, installation_cost_amount, items_iva_total, installation_cost_iva_amount
from repositories.app_setting_repository import AppSettingRepository
from repositories.quote_repository import QuoteRepository
from repositories.product_repository import ProductVariantRepository
from repositories.supply_repository import SupplyVariantRepository
from schemas.quote import QuoteCreate, QuoteUpdate, QuoteItemCreate, QuoteItemUpdate
from models.quote import Quote, QuoteItem
from models.user import User
from models.enums import QuoteItemKind, QuoteStatus, QuoteType, InstallationCostType
from exceptions.general import NotFoundException, ForbiddenException, BadRequestException

# Valid forward transitions only
VALID_TRANSITIONS: dict[QuoteStatus, list[QuoteStatus]] = {
    QuoteStatus.borrador: [QuoteStatus.enviada],
    QuoteStatus.enviada: [QuoteStatus.aprobada, QuoteStatus.rechazada, QuoteStatus.vencida],
    QuoteStatus.aprobada: [],
    QuoteStatus.rechazada: [],
    QuoteStatus.vencida: [],
}

# Both quote types allow the same set of item kinds — the productos and
# servicios flows are distinguished by page/branding/listing, not by which
# item kinds they may contain. Kept as a per-quote_type map (rather than a
# flat set) so _assert_item_kind_allowed stays a fail-closed guard for any
# future quote_type that shouldn't inherit this default.
ALLOWED_ITEM_KINDS: dict[QuoteType, frozenset[QuoteItemKind]] = {
    QuoteType.productos: frozenset(
        {QuoteItemKind.product, QuoteItemKind.supply, QuoteItemKind.service}
    ),
    QuoteType.servicios: frozenset(
        {QuoteItemKind.product, QuoteItemKind.supply, QuoteItemKind.service}
    ),
}

_KIND_LABELS = {
    QuoteItemKind.product: "productos",
    QuoteItemKind.supply: "insumos",
    QuoteItemKind.service: "conceptos manuales",
}


def _assert_item_kind_allowed(quote_type: QuoteType, kind: QuoteItemKind) -> None:
    # .get(..., frozenset()) is fail-closed: an unrecognized quote_type
    # allows nothing rather than silently allowing everything.
    if kind not in ALLOWED_ITEM_KINDS.get(quote_type, frozenset()):
        raise BadRequestException(
            f"No se pueden agregar {_KIND_LABELS.get(kind, 'ítems de ese tipo')} "
            f"a una cotización de {quote_type.value}"
        )


def _add_total(quote: Quote) -> Quote:
    """Attach computed, non-persisted attributes the response schema needs."""
    quote.total = quote_total(quote)
    quote.installation_cost_amount = installation_cost_amount(quote)
    quote.iva_amount = (
        items_iva_total(quote) + installation_cost_iva_amount(quote)
        if quote.contempla_iva
        else Decimal("0")
    )
    quote.updated_by_name = (
        f"{quote.updated_by.nombre} {quote.updated_by.apellido}" if quote.updated_by else None
    )
    return quote


def _validate_installation_cost(
    cost_type, cost_value: Decimal | None, quote_type: QuoteType = QuoteType.productos
) -> None:
    if cost_type is None:
        return
    if quote_type == QuoteType.servicios:
        raise BadRequestException(
            "Las cotizaciones de servicios no llevan costo de instalación"
        )
    if cost_value is None:
        raise BadRequestException("Debés indicar un valor para el costo de instalación")
    if cost_value < 0:
        raise BadRequestException("El costo de instalación no puede ser negativo")
    if cost_type == InstallationCostType.percentage and cost_value > 100:
        raise BadRequestException("El porcentaje de instalación no puede superar 100")


class QuoteService:
    def __init__(self, db: AsyncSession):
        self.repo = QuoteRepository(db)
        self.setting_repo = AppSettingRepository(db)
        self.variant_repo = ProductVariantRepository(db)
        self.supply_variant_repo = SupplyVariantRepository(db)

    async def get_hourly_rate(self) -> Decimal:
        val = await self.setting_repo.get_value("hourly_rate")
        return Decimal(val or "0")

    def _check_ownership(self, quote: Quote, user: User) -> None:
        if "QUOTE_VIEW_ALL" not in (p.value if hasattr(p, "value") else p for p in user.permissions):
            if quote.created_by_id != user.id:
                raise ForbiddenException("No autorizado para ver esta cotización")

    async def create(self, data: QuoteCreate, created_by_id: uuid.UUID) -> Quote:
        _validate_installation_cost(
            data.installation_cost_type, data.installation_cost_value, data.quote_type
        )
        # Fail fast on a bad payload before any row is written.
        for item_data in data.items:
            _assert_item_kind_allowed(data.quote_type, item_data.kind)
        hourly_rate = await self.get_hourly_rate()

        quote = await self.repo.create_quote(
            quote_type=data.quote_type,
            title=data.title,
            client_name=data.client_name,
            client_email=str(data.client_email),
            client_phone=data.client_phone,
            validity_days=data.validity_days,
            notes=data.notes,
            consultation_id=data.consultation_id,
            installation_cost_type=data.installation_cost_type,
            installation_cost_value=data.installation_cost_value,
            contempla_iva=data.contempla_iva,
            created_by_id=created_by_id,
            cost_notes=data.cost_notes,
            margin_notes=data.margin_notes,
            internal_comments=data.internal_comments,
        )

        for item_data in data.items:
            await self._build_item(quote.id, item_data, hourly_rate, data.quote_type)

        # Reload with items
        full_quote = await self.repo.get_with_items(quote.id)
        return _add_total(full_quote)

    async def _build_item(
        self,
        quote_id: uuid.UUID,
        item_data: QuoteItemCreate,
        hourly_rate: Decimal,
        quote_type: QuoteType,
    ) -> QuoteItem:
        _assert_item_kind_allowed(quote_type, item_data.kind)

        product_name_snapshot = None
        product_sku_snapshot = None
        supply_name_snapshot = None
        supply_sku_snapshot = None
        hourly_rate_snapshot = None
        iva_rate = Decimal("0")

        if item_data.kind == QuoteItemKind.product and item_data.product_variant_id:
            variant = await self.variant_repo.get_with_product(item_data.product_variant_id)
            if variant:
                product_name_snapshot = (
                    f"{variant.product.name} — {variant.name}" if variant.product else variant.name
                )
                product_sku_snapshot = variant.sku
                if variant.product:
                    iva_rate = Decimal(variant.product.iva_rate.value)

        if item_data.kind == QuoteItemKind.supply:
            supply_variant = (
                await self.supply_variant_repo.get_with_supply(item_data.supply_variant_id)
                if item_data.supply_variant_id
                else None
            )
            if supply_variant is None:
                raise NotFoundException("Insumo no encontrado")
            supply_name_snapshot = f"{supply_variant.supply.name} — {supply_variant.name}"
            supply_sku_snapshot = supply_variant.sku
            # iva_rate is always server-derived from the supply — the client
            # value is ignored (mirrors kind=product's rule, D4). unit_price
            # stays client-supplied, same as kind=product.
            iva_rate = Decimal(supply_variant.supply.iva_rate.value)

        if item_data.kind == QuoteItemKind.service:
            hourly_rate_snapshot = hourly_rate
            # Client-supplied only for services; never trusted for products
            # or supplies.
            iva_rate = item_data.iva_rate if item_data.iva_rate is not None else Decimal("21")

        subtotal = item_data.unit_price * item_data.quantity

        return await self.repo.create_item(
            quote_id=quote_id,
            kind=item_data.kind,
            display_order=item_data.display_order,
            product_variant_id=item_data.product_variant_id,
            product_name_snapshot=product_name_snapshot,
            product_sku_snapshot=product_sku_snapshot,
            supply_variant_id=item_data.supply_variant_id,
            supply_name_snapshot=supply_name_snapshot,
            supply_sku_snapshot=supply_sku_snapshot,
            service_description=item_data.service_description,
            hours=item_data.hours,
            hourly_rate_snapshot=hourly_rate_snapshot,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            subtotal=subtotal,
            iva_rate=iva_rate,
        )

    async def get_by_id(self, id: uuid.UUID, user: User) -> Quote:
        quote = await self.repo.get_with_items(id)
        if not quote:
            raise NotFoundException("Cotización no encontrada")
        self._check_ownership(quote, user)
        return _add_total(quote)

    async def list_for_user(
        self, user: User, quote_type: QuoteType = QuoteType.productos
    ) -> list[Quote]:
        has_view_all = "QUOTE_VIEW_ALL" in (
            p.value if hasattr(p, "value") else p for p in user.permissions
        )
        if has_view_all:
            quotes = await self.repo.get_all_ordered(quote_type)
        else:
            quotes = await self.repo.get_all_for_user(user.id, quote_type)
        for q in quotes:
            _add_total(q)
        return quotes

    async def update(self, id: uuid.UUID, data: QuoteUpdate, user: User) -> Quote:
        quote = await self.repo.get_with_items(id)
        if not quote:
            raise NotFoundException("Cotización no encontrada")
        self._check_ownership(quote, user)

        update_data = data.model_dump(exclude_unset=True)

        # Validate status transition
        if "status" in update_data:
            new_status = update_data["status"]
            allowed = VALID_TRANSITIONS.get(quote.status, [])
            if new_status not in allowed:
                raise BadRequestException(
                    f"No se puede cambiar de '{quote.status.value}' a '{new_status.value}'"
                )

        # Validate installation cost against the effective (merged) values.
        # quote.quote_type is read from the loaded row, never from the
        # payload — QuoteUpdate has no such field (D10, immutability).
        if "installation_cost_type" in update_data or "installation_cost_value" in update_data:
            effective_type = update_data.get("installation_cost_type", quote.installation_cost_type)
            effective_value = update_data.get("installation_cost_value", quote.installation_cost_value)
            _validate_installation_cost(effective_type, effective_value, quote.quote_type)

        update_data["updated_by_id"] = user.id
        await self.repo.update_quote(quote, **update_data)
        updated = await self.repo.get_with_items(id)
        return _add_total(updated)

    async def delete(self, id: uuid.UUID, user: User) -> None:
        quote = await self.repo.get_with_items(id)
        if not quote:
            raise NotFoundException("Cotización no encontrada")
        self._check_ownership(quote, user)
        if quote.status != QuoteStatus.borrador:
            raise BadRequestException("Solo se pueden eliminar cotizaciones en borrador")
        await self.repo.soft_delete(id)

    async def add_item(self, quote_id: uuid.UUID, data: QuoteItemCreate, user: User) -> Quote:
        quote = await self.repo.get_with_items(quote_id)
        if not quote:
            raise NotFoundException("Cotización no encontrada")
        self._check_ownership(quote, user)

        hourly_rate = await self.get_hourly_rate()
        await self._build_item(quote_id, data, hourly_rate, quote.quote_type)
        await self.repo.update_quote(quote, updated_by_id=user.id)

        updated = await self.repo.get_with_items(quote_id)
        return _add_total(updated)

    async def update_item(
        self, quote_id: uuid.UUID, item_id: uuid.UUID, data: QuoteItemUpdate, user: User
    ) -> Quote:
        quote = await self.repo.get_with_items(quote_id)
        if not quote:
            raise NotFoundException("Cotización no encontrada")
        self._check_ownership(quote, user)

        item = await self.repo.get_item(item_id)
        if not item or item.quote_id != quote_id:
            raise NotFoundException("Ítem no encontrado en esta cotización")

        # Editing is only allowed for manually-added concept lines — catalog
        # -linked product/supply items are immutable via this endpoint (D per
        # request: delete+re-add covers those instead).
        if item.kind != QuoteItemKind.service:
            raise BadRequestException(
                "Solo se pueden editar los conceptos manuales de la cotización"
            )

        update_data = data.model_dump(exclude_unset=True)

        # subtotal is derived, not client-supplied — recompute it whenever
        # either factor changes, mirroring _build_item's subtotal formula.
        if "quantity" in update_data or "unit_price" in update_data:
            new_quantity = update_data.get("quantity", item.quantity)
            new_unit_price = update_data.get("unit_price", item.unit_price)
            update_data["subtotal"] = new_unit_price * new_quantity

        await self.repo.update_item(item, **update_data)
        await self.repo.update_quote(quote, updated_by_id=user.id)

        updated = await self.repo.get_with_items(quote_id)
        return _add_total(updated)

    async def remove_item(self, quote_id: uuid.UUID, item_id: uuid.UUID, user: User) -> None:
        quote = await self.repo.get_with_items(quote_id)
        if not quote:
            raise NotFoundException("Cotización no encontrada")
        self._check_ownership(quote, user)

        item = await self.repo.get_item(item_id)
        if not item or item.quote_id != quote_id:
            raise NotFoundException("Ítem no encontrado en esta cotización")

        await self.repo.db.delete(item)
        await self.repo.update_quote(quote, updated_by_id=user.id)
