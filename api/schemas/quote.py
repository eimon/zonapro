import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, model_validator
from models.enums import QuoteItemKind, QuoteStatus


class QuoteItemCreate(BaseModel):
    kind: QuoteItemKind
    display_order: int = 0
    # product kind
    product_variant_id: Optional[uuid.UUID] = None
    # service kind
    service_description: Optional[str] = None
    hours: Optional[Decimal] = None
    # common
    quantity: int = 1
    unit_price: Decimal


class QuoteItemResponse(BaseModel):
    id: uuid.UUID
    kind: QuoteItemKind
    display_order: int
    product_variant_id: Optional[uuid.UUID]
    product_name_snapshot: Optional[str]
    product_sku_snapshot: Optional[str]
    service_description: Optional[str]
    hours: Optional[Decimal]
    hourly_rate_snapshot: Optional[Decimal]
    quantity: int
    unit_price: Decimal
    subtotal: Decimal

    model_config = {"from_attributes": True}


class QuoteCreate(BaseModel):
    title: str
    client_name: str
    client_email: EmailStr
    client_phone: Optional[str] = None
    validity_days: int = 30
    notes: Optional[str] = None
    consultation_id: Optional[uuid.UUID] = None
    # Internal fields (VENDEDOR fills these in)
    cost_notes: Optional[str] = None
    margin_notes: Optional[str] = None
    internal_comments: Optional[str] = None
    items: list[QuoteItemCreate] = []


class QuoteUpdate(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[EmailStr] = None
    client_phone: Optional[str] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    cost_notes: Optional[str] = None
    margin_notes: Optional[str] = None
    internal_comments: Optional[str] = None
    status: Optional[QuoteStatus] = None


# CLIENT response — no internal fields
class QuoteClientResponse(BaseModel):
    id: uuid.UUID
    title: str
    client_name: str
    client_email: str
    client_phone: Optional[str]
    validity_days: int
    notes: Optional[str]
    status: QuoteStatus
    consultation_id: Optional[uuid.UUID]
    created_at: datetime
    items: list[QuoteItemResponse] = []
    total: Decimal = Decimal("0")

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
        return data


# INTERNAL response — includes internal fields (for VENDEDOR/ADMIN panel)
class QuoteInternalResponse(QuoteClientResponse):
    cost_notes: Optional[str]
    margin_notes: Optional[str]
    internal_comments: Optional[str]
    created_by_id: uuid.UUID
