import uuid
from sqlalchemy import Column, String, Text, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import Numeric
from sqlalchemy import Enum as SAEnum
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
from models.enums import QuoteStatus, QuoteItemKind, InstallationCostType


class Quote(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "quotes"

    # Client-visible fields
    title = Column(String(300), nullable=False)
    client_name = Column(String(200), nullable=False)
    client_email = Column(String(255), nullable=False)
    client_phone = Column(String(50), nullable=True)
    validity_days = Column(Integer, nullable=False, default=30)
    notes = Column(Text, nullable=True)
    status = Column(
        SAEnum(QuoteStatus),
        nullable=False,
        default=QuoteStatus.borrador,
    )

    # Installation cost — fixed amount or percentage of the products subtotal
    installation_cost_type = Column(SAEnum(InstallationCostType), nullable=True)
    installation_cost_value = Column(Numeric(12, 2), nullable=True)

    # Internal-only fields — never serialized in client response or PDF
    cost_notes = Column(Text, nullable=True)
    margin_notes = Column(Text, nullable=True)
    internal_comments = Column(Text, nullable=True)

    # Optional link to a consultation
    consultation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("consultations.id"),
        nullable=True,
        index=True,
    )

    # Vendor who created this quote
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Vendor who last edited this quote (null until the first edit)
    updated_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    # Relationships
    items = relationship(
        "QuoteItem",
        back_populates="quote",
        cascade="all, delete-orphan",
        order_by="QuoteItem.display_order",
    )
    consultation = relationship("Consultation", foreign_keys=[consultation_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])


class QuoteItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "quote_items"

    quote_id = Column(
        UUID(as_uuid=True),
        ForeignKey("quotes.id"),
        nullable=False,
        index=True,
    )
    kind = Column(SAEnum(QuoteItemKind), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)

    # For kind=product
    product_variant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id"),
        nullable=True,
    )
    product_name_snapshot = Column(String(300), nullable=True)
    product_sku_snapshot = Column(String(100), nullable=True)

    # For kind=service
    service_description = Column(Text, nullable=True)
    hours = Column(Numeric(8, 2), nullable=True)
    hourly_rate_snapshot = Column(Numeric(12, 2), nullable=True)

    # Common
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    # Relationships
    quote = relationship("Quote", back_populates="items")
    variant = relationship("ProductVariant", foreign_keys=[product_variant_id])
