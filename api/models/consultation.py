from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from core.database import Base
from models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
from models.enums import ConsultationType, ConsultationStatus
from sqlalchemy import Enum as SAEnum


class Consultation(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "consultations"

    # Submitter info (captured at submission time)
    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)

    # Optional link to authenticated user
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    # Type and content
    type = Column(SAEnum(ConsultationType), nullable=False)
    message = Column(Text, nullable=True)

    # Optional references
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id"), nullable=True)
    selected_options = Column(JSONB, nullable=False, default=dict)

    # Status
    status = Column(
        SAEnum(ConsultationStatus),
        nullable=False,
        default=ConsultationStatus.pendiente,
    )
    internal_notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    product = relationship("Product", foreign_keys=[product_id])
    package = relationship("Package", foreign_keys=[package_id])
