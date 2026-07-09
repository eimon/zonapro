import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr
from models.enums import ConsultationType, ConsultationStatus


class ConsultationCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    type: ConsultationType
    message: str | None = None
    product_id: uuid.UUID | None = None
    package_id: uuid.UUID | None = None
    selected_options: dict = {}


class ConsultationUpdate(BaseModel):
    status: ConsultationStatus | None = None
    internal_notes: str | None = None


class ConsultationResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    phone: str | None
    type: ConsultationType
    message: str | None
    product_id: uuid.UUID | None
    package_id: uuid.UUID | None
    selected_options: dict
    status: ConsultationStatus
    internal_notes: str | None
    user_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConsultationPublicResponse(BaseModel):
    id: uuid.UUID
    status: ConsultationStatus
    created_at: datetime

    model_config = {"from_attributes": True}
