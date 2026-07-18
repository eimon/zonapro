from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin


class PasswordResetToken(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "password_reset_tokens"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
