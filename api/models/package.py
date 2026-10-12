from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SAEnum
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
from models.enums import PackagePricingMode, PackageItemKind


class Package(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "packages"

    name = Column(String(200), nullable=False)
    slug = Column(String(220), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    # Admin picks pricing_mode once; the fields actually used depend on it —
    # the other set stays NULL, enforced by ck_package_pricing_mode_matches_values:
    #   - discount_percent mode: `discount_percent` holds the percent (0-100).
    #     A discount is currency-independent, so ONE value covers both
    #     currencies — final_price per currency is always derived at read
    #     time from live catalog prices in that currency (core/package_pricing.py).
    #   - final_price mode: `pricing_value_ars` / `pricing_value_usd` each
    #     hold a manually-entered NET final price for that currency. Either
    #     may be left NULL (package unavailable in that currency) but at
    #     least one must be set.
    # In both modes the chosen mode+value(s) stay fixed even as catalog
    # prices change — only the derived numbers move.
    pricing_mode = Column(SAEnum(PackagePricingMode), nullable=False)
    discount_percent = Column(Numeric(5, 2), nullable=True)
    pricing_value_ars = Column(Numeric(12, 2), nullable=True)
    pricing_value_usd = Column(Numeric(12, 2), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    items = relationship(
        "PackageItem",
        back_populates="package",
        cascade="all, delete-orphan",
        order_by="PackageItem.display_order",
    )

    __table_args__ = (
        CheckConstraint(
            "(pricing_mode = 'discount_percent' AND discount_percent IS NOT NULL "
            "AND discount_percent > 0 AND discount_percent < 100 "
            "AND pricing_value_ars IS NULL AND pricing_value_usd IS NULL) "
            "OR "
            "(pricing_mode = 'final_price' AND discount_percent IS NULL "
            "AND (pricing_value_ars IS NOT NULL OR pricing_value_usd IS NOT NULL) "
            "AND (pricing_value_ars IS NULL OR pricing_value_ars > 0) "
            "AND (pricing_value_usd IS NULL OR pricing_value_usd > 0))",
            name="ck_package_pricing_mode_matches_values",
        ),
    )


class PackageItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "package_items"

    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True)
    kind = Column(SAEnum(PackageItemKind), nullable=False)
    # Exactly one of these two is set, matching `kind` — enforced by
    # ck_package_item_kind_matches_variant below.
    product_variant_id = Column(
        UUID(as_uuid=True), ForeignKey("product_variants.id"), nullable=True, index=True
    )
    supply_variant_id = Column(
        UUID(as_uuid=True), ForeignKey("supply_variants.id"), nullable=True, index=True
    )
    quantity = Column(Numeric(10, 2), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)

    package = relationship("Package", back_populates="items")
    product_variant = relationship("ProductVariant", foreign_keys=[product_variant_id])
    supply_variant = relationship("SupplyVariant", foreign_keys=[supply_variant_id])

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_package_item_quantity_positive"),
        CheckConstraint(
            "(kind = 'product' AND product_variant_id IS NOT NULL AND supply_variant_id IS NULL) OR "
            "(kind = 'supply' AND supply_variant_id IS NOT NULL AND product_variant_id IS NULL)",
            name="ck_package_item_kind_matches_variant",
        ),
    )
