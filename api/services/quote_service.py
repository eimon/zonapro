import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.quote_repository import QuoteRepository, AppSettingRepository
from repositories.product_repository import ProductVariantRepository
from schemas.quote import QuoteCreate, QuoteUpdate, QuoteItemCreate
from models.quote import Quote, QuoteItem
from models.user import User
from models.enums import QuoteItemKind, QuoteStatus
from exceptions.general import NotFoundException, ForbiddenException, BadRequestException

# Valid forward transitions only
VALID_TRANSITIONS: dict[QuoteStatus, list[QuoteStatus]] = {
    QuoteStatus.borrador: [QuoteStatus.enviada],
    QuoteStatus.enviada: [QuoteStatus.aprobada, QuoteStatus.rechazada, QuoteStatus.vencida],
    QuoteStatus.aprobada: [],
    QuoteStatus.rechazada: [],
    QuoteStatus.vencida: [],
}


def _compute_total(quote: Quote) -> Decimal:
    return sum((item.subtotal for item in quote.items), Decimal("0"))


def _add_total(quote: Quote) -> Quote:
    """Attach a computed total attribute to the quote instance."""
    quote.total = _compute_total(quote)
    return quote


class QuoteService:
    def __init__(self, db: AsyncSession):
        self.repo = QuoteRepository(db)
        self.setting_repo = AppSettingRepository(db)
        self.variant_repo = ProductVariantRepository(db)

    async def get_hourly_rate(self) -> Decimal:
        val = await self.setting_repo.get_value("hourly_rate")
        return Decimal(val or "0")

    def _check_ownership(self, quote: Quote, user: User) -> None:
        if "QUOTE_VIEW_ALL" not in (p.value if hasattr(p, "value") else p for p in user.permissions):
            if quote.created_by_id != user.id:
                raise ForbiddenException("No autorizado para ver esta cotización")

    async def create(self, data: QuoteCreate, created_by_id: uuid.UUID) -> Quote:
        hourly_rate = await self.get_hourly_rate()

        quote = await self.repo.create_quote(
            title=data.title,
            client_name=data.client_name,
            client_email=str(data.client_email),
            client_phone=data.client_phone,
            validity_days=data.validity_days,
            notes=data.notes,
            consultation_id=data.consultation_id,
            created_by_id=created_by_id,
            cost_notes=data.cost_notes,
            margin_notes=data.margin_notes,
            internal_comments=data.internal_comments,
        )

        for item_data in data.items:
            await self._build_item(quote.id, item_data, hourly_rate)

        # Reload with items
        full_quote = await self.repo.get_with_items(quote.id)
        return _add_total(full_quote)

    async def _build_item(
        self, quote_id: uuid.UUID, item_data: QuoteItemCreate, hourly_rate: Decimal
    ) -> QuoteItem:
        product_name_snapshot = None
        product_sku_snapshot = None
        hourly_rate_snapshot = None

        if item_data.kind == QuoteItemKind.product and item_data.product_variant_id:
            variant = await self.variant_repo.get_by_id(item_data.product_variant_id)
            if variant:
                product_name_snapshot = variant.name
                product_sku_snapshot = variant.sku

        if item_data.kind == QuoteItemKind.service:
            hourly_rate_snapshot = hourly_rate

        subtotal = item_data.unit_price * item_data.quantity

        return await self.repo.create_item(
            quote_id=quote_id,
            kind=item_data.kind,
            display_order=item_data.display_order,
            product_variant_id=item_data.product_variant_id,
            product_name_snapshot=product_name_snapshot,
            product_sku_snapshot=product_sku_snapshot,
            service_description=item_data.service_description,
            hours=item_data.hours,
            hourly_rate_snapshot=hourly_rate_snapshot,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            subtotal=subtotal,
        )

    async def get_by_id(self, id: uuid.UUID, user: User) -> Quote:
        quote = await self.repo.get_with_items(id)
        if not quote:
            raise NotFoundException("Cotización no encontrada")
        self._check_ownership(quote, user)
        return _add_total(quote)

    async def list_for_user(self, user: User) -> list[Quote]:
        has_view_all = "QUOTE_VIEW_ALL" in (
            p.value if hasattr(p, "value") else p for p in user.permissions
        )
        if has_view_all:
            quotes = await self.repo.get_all_ordered()
        else:
            quotes = await self.repo.get_all_for_user(user.id)
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

        updated = await self.repo.update_quote(quote, **update_data)
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
        await self._build_item(quote_id, data, hourly_rate)

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
        await self.repo.db.flush()
