from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin


class Category(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "categories"

    name = Column(String(120), nullable=False, unique=True)
    slug = Column(String(140), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)

    products = relationship("Product", back_populates="category")
