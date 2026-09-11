import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, model_validator
from models.enums import QuoteItemKind, QuoteStatus, QuoteType, InstallationCostType


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
    quantity: int = 1
    unit_price: Decimal
    # Only honored for kind=service; ignored server-side for kind=product and
    # kind=supply, where it's always derived from the product's/supply's own
    # iva_rate.
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
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    iva_rate: Decimal

    model_config = {"from_attributes": True}


class QuoteCreate(BaseModel):
    # Set once at creation, determined by which flow is invoked (productos
    # pages omit this and get the default; servicios pages send it
    # explicitly). Deliberately absent from QuoteUpdate — see below.
    quote_type: QuoteType = QuoteType.productos
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
