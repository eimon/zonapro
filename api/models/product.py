import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, CheckConstraint, UniqueConstraint, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin


class Product(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "products"

    name = Column(String(200), nullable=False)
    slug = Column(String(220), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    base_price = Column(Numeric(12, 2), nullable=False, default=0)
    image_url = Column(String(500), nullable=True)
    made_to_order = Column(Boolean, nullable=False, default=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)

    category = relationship("Category", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("base_price >= 0", name="ck_product_base_price_non_negative"),
        Index("ix_products_category_active", "category_id", "is_active"),
    )


class ProductVariant(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "product_variants"

    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    sku = Column(String(80), nullable=False)
    name = Column(String(200), nullable=False)
    attributes = Column(JSONB, nullable=True, default=dict)
    price = Column(Numeric(12, 2), nullable=True)
    stock_qty = Column(Integer, nullable=False, default=0)

    product = relationship("Product", back_populates="variants")

    __table_args__ = (
        CheckConstraint("price IS NULL OR price >= 0", name="ck_variant_price_non_negative"),
        CheckConstraint("stock_qty >= 0", name="ck_variant_stock_non_negative"),
        UniqueConstraint("product_id", "sku", name="uq_variant_product_sku"),
    )
