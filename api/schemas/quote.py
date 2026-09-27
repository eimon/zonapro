import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, Field, model_validator
from models.enums import QuoteItemKind, QuoteStatus, QuoteType, InstallationCostType, Currency

# The quote-creation currency default. USD because after the pricing
# migration only USD prices exist in the catalog by default — flip this one
# constant (and CATALOG_DEFAULT_CURRENCY on the web) once ARS prices are
# broadly populated.
DEFAULT_QUOTE_CURRENCY = Currency.USD


class QuoteItemCreate(BaseModel):
    kind: QuoteItemKind
    display_order: int = 0
    # product kind
    product_variant_id: Optional[uuid.UUID] = None
    # supply kind
    supply_variant_id: Optional[uuid.UUID] = None
    # service kind
    service_description: Optional[str] = None
    hours: Optional[Decimal] = None
    # common
    quantity: Decimal = Field(default=Decimal("1"), gt=0, max_digits=10, decimal_places=2)
    # Required for kind=service (manual concept lines) — for kind=product and
    # kind=supply this is ignored server-side and always derived from the
    # variant's price in the quote's own currency instead (rejecting with a
    # BadRequest if that price is NULL), mirroring how iva_rate is already
    # server-derived for those two kinds.
    unit_price: Optional[Decimal] = None
    # Only honored for kind=service; ignored server-side for kind=product and
    # kind=supply, where it's always derived from the product's/supply's own
    # iva_rate.
    iva_rate: Optional[Decimal] = None

    @model_validator(mode="after")
    def product_quantity_is_whole(self) -> "QuoteItemCreate":
        # Fractional quantities only make sense for supplies (meters of cable,
        # liters…) and manual concepts; a product is always a whole unit.
        if self.kind == QuoteItemKind.product and self.quantity != self.quantity.to_integral_value():
            raise ValueError("La cantidad de un producto debe ser un número entero")
        return self

    @model_validator(mode="after")
    def service_requires_unit_price(self) -> "QuoteItemCreate":
        # Client-supplied unit_price is required for manual concept lines
        # (kind=service) and for a manual, catalog-less product line
        # (kind=product with no product_variant_id) — every other case
        # (kind=product with a variant, or kind=supply, which always
        # requires a variant) derives it server-side from the catalog.
        needs_client_price = self.kind == QuoteItemKind.service or (
            self.kind == QuoteItemKind.product and self.product_variant_id is None
        )
        if needs_client_price and self.unit_price is None:
            raise ValueError("Este ítem requiere unit_price")
        return self


class QuoteItemUpdate(BaseModel):
    # Editing is only allowed for kind=service items (manually-added concept
    # lines) — kind, product_variant_id, and supply_variant_id are
    # deliberately absent here and stay immutable via this endpoint; use
    # delete+re-add to change a catalog-linked item.
    service_description: Optional[str] = None
    quantity: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    unit_price: Optional[Decimal] = None
    iva_rate: Optional[Decimal] = None


class QuoteItemResponse(BaseModel):
    id: uuid.UUID
    kind: QuoteItemKind
    display_order: int
    product_variant_id: Optional[uuid.UUID]
    product_name_snapshot: Optional[str]
    product_sku_snapshot: Optional[str]
    supply_variant_id: Optional[uuid.UUID]
    supply_name_snapshot: Optional[str]
    supply_sku_snapshot: Optional[str]
    service_description: Optional[str]
    hours: Optional[Decimal]
    hourly_rate_snapshot: Optional[Decimal]
    # float, not Decimal: Pydantic serializes Decimal as a JSON string, and
    # the web consumes quantity as a number.
    quantity: float
    unit_price: Decimal
    subtotal: Decimal
    iva_rate: Decimal

    model_config = {"from_attributes": True}


class QuoteCreate(BaseModel):
    # Set once at creation, determined by which flow is invoked (productos
    # pages omit this and get the default; servicios pages send it
    # explicitly). Deliberately absent from QuoteUpdate — see below.
    quote_type: QuoteType = QuoteType.productos
    # Set once at creation; locked once the quote has items (enforced
    # service-side — see QuoteService.update).
    currency: Currency = DEFAULT_QUOTE_CURRENCY
    title: str
    client_name: str
    client_email: EmailStr
    client_phone: Optional[str] = None
    validity_days: int = 30
    notes: Optional[str] = None
    consultation_id: Optional[uuid.UUID] = None
    installation_cost_type: Optional[InstallationCostType] = None
    installation_cost_value: Optional[Decimal] = None
    contempla_iva: bool = True
    # Internal fields (VENDEDOR fills these in)
    cost_notes: Optional[str] = None
    margin_notes: Optional[str] = None
    internal_comments: Optional[str] = None
    items: list[QuoteItemCreate] = []


class QuoteUpdate(BaseModel):
    # quote_type is deliberately NOT a field here — it is immutable after
    # creation. update_data = model_dump(exclude_unset=True) can never carry
    # it into repo.update_quote(**update_data), so this is a structural
    # guarantee rather than a runtime guard.
    # currency IS present here (unlike quote_type) because it may still be
    # changed up until the first item is added — locked afterward, enforced
    # in QuoteService.update.
    currency: Optional[Currency] = None
    title: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[EmailStr] = None
    client_phone: Optional[str] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    installation_cost_type: Optional[InstallationCostType] = None
    installation_cost_value: Optional[Decimal] = None
    contempla_iva: Optional[bool] = None
    cost_notes: Optional[str] = None
    margin_notes: Optional[str] = None
    internal_comments: Optional[str] = None
    status: Optional[QuoteStatus] = None


# CLIENT response — no internal fields
class QuoteClientResponse(BaseModel):
    id: uuid.UUID
    quote_type: QuoteType
    currency: Currency
    title: str
    client_name: str
    client_email: str
    client_phone: Optional[str]
    validity_days: int
    notes: Optional[str]
    status: QuoteStatus
    consultation_id: Optional[uuid.UUID]
    installation_cost_type: Optional[InstallationCostType]
    installation_cost_value: Optional[Decimal]
    installation_cost_amount: Decimal = Decimal("0")
    contempla_iva: bool
    created_at: datetime
    updated_at: datetime
    updated_by_id: Optional[uuid.UUID]
    updated_by_name: Optional[str] = None
    items: list[QuoteItemResponse] = []
    total: Decimal = Decimal("0")
    iva_amount: Decimal = Decimal("0")

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def compute_total(cls, data: Any) -> Any:
        # When deserializing from ORM, compute total from items if not set
        if hasattr(data, "__dict__"):
            # ORM object — use the total attribute set by the service
            if not hasattr(data, "total") or data.total is None:
                items = getattr(data, "items", []) or []
                object.__setattr__(data, "total", sum((i.subtotal for i in items), Decimal("0")))
            if not hasattr(data, "iva_amount") or data.iva_amount is None:
                object.__setattr__(data, "iva_amount", Decimal("0"))
        return data


# INTERNAL response — includes internal fields (for VENDEDOR/ADMIN panel)
class QuoteInternalResponse(QuoteClientResponse):
    cost_notes: Optional[str]
    margin_notes: Optional[str]
    internal_comments: Optional[str]
    created_by_id: uuid.UUID
