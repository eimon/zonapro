from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, CheckConstraint, UniqueConstraint, ForeignKey, Index, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
from models.enums import IvaRate


class Supply(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "supplies"

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    iva_rate = Column(SAEnum(IvaRate), nullable=False, default=IvaRate.iva_21)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    variants = relationship("SupplyVariant", back_populates="supply", cascade="all, delete-orphan")

    __table_args__ = (
        Index("uq_supplies_name_active", "name", unique=True, postgresql_where=text("deleted_at IS NULL")),
    )


class SupplyVariant(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "supply_variants"

    supply_id = Column(UUID(as_uuid=True), ForeignKey("supplies.id"), nullable=False, index=True)
    sku = Column(String(80), nullable=False)
    name = Column(String(200), nullable=False)
    attributes = Column(JSONB, nullable=True, default=dict)
    # Prices are NET (no IVA), manually edited, never auto-converted between
    # currencies. At least one of the two must be set — see
    # ck_supply_variant_price_at_least_one.
    price_usd = Column(Numeric(12, 2), nullable=True)
    price_ars = Column(Numeric(12, 2), nullable=True)
    stock_qty = Column(Integer, nullable=False, default=0)

    supply = relationship("Supply", back_populates="variants")

    __table_args__ = (
        CheckConstraint("price_usd >= 0", name="ck_supply_variant_price_usd_non_negative"),
        CheckConstraint("price_ars >= 0", name="ck_supply_variant_price_ars_non_negative"),
        CheckConstraint(
            "price_usd IS NOT NULL OR price_ars IS NOT NULL",
            name="ck_supply_variant_price_at_least_one",
        ),
        CheckConstraint("stock_qty >= 0", name="ck_supply_variant_stock_non_negative"),
        UniqueConstraint("supply_id", "sku", name="uq_supply_variant_supply_sku"),
        Index("uq_supply_variant_sku_active", "sku", unique=True, postgresql_where=text("deleted_at IS NULL")),
    )
