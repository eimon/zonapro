from sqlalchemy import Column, String, Boolean, Enum as SAEnum
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    VENDEDOR = "vendedor"
    CLIENTE = "cliente"


class User(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"

    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.CLIENTE)
    is_active = Column(Boolean, default=True, nullable=False)
