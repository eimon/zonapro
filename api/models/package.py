import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
from models.enums import PackageComplexity
from sqlalchemy import Enum as SAEnum


class Package(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "packages"

    name = Column(String(200), nullable=False)
    slug = Column(String(220), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    complexity = Column(SAEnum(PackageComplexity), nullable=False)
    base_price = Column(Numeric(12, 2), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    option_groups = relationship(
        "PackageOptionGroup",
        back_populates="package",
        cascade="all, delete-orphan",
        order_by="PackageOptionGroup.display_order",
    )

    __table_args__ = (
        CheckConstraint("base_price >= 0", name="ck_package_base_price_non_negative"),
    )


class PackageOptionGroup(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "package_option_groups"

    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)

    package = relationship("Package", back_populates="option_groups")
    options = relationship(
        "PackageOption",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="PackageOption.display_order",
    )


class PackageOption(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "package_options"

    group_id = Column(UUID(as_uuid=True), ForeignKey("package_option_groups.id"), nullable=False, index=True)
    label = Column(String(200), nullable=False)
    price_delta = Column(Numeric(12, 2), nullable=False, default=0)
    is_default = Column(Boolean, nullable=False, default=False)
    display_order = Column(Integer, nullable=False, default=0)

    group = relationship("PackageOptionGroup", back_populates="options")
