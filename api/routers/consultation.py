import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from core.rate_limit import check_rate_limit
from dependencies.auth import has_role, get_optional_user
from models.user import User
from services.consultation_service import ConsultationService
from schemas.consultation import (
    ConsultationCreate,
    ConsultationUpdate,
    ConsultationResponse,
    ConsultationPublicResponse,
)

router = APIRouter(prefix=f"{settings.API_V1_STR}/consultations", tags=["consultations"])


@router.post("/", response_model=ConsultationPublicResponse, status_code=201)
async def create_consultation(
    data: ConsultationCreate,
    db: AsyncSession = Depends(get_db),
    _rate=Depends(check_rate_limit),
    current_user: User | None = Depends(get_optional_user),
):
    user_id = current_user.id if current_user else None
    consultation = await ConsultationService(db).create(data, user_id=user_id)
    return consultation


@router.get("/", response_model=list[ConsultationResponse])
async def list_consultations(
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.CONSULTATION_MANAGE)),
):
    return await ConsultationService(db).get_all()


@router.get("/{consultation_id}", response_model=ConsultationResponse)
async def get_consultation(
    consultation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.CONSULTATION_MANAGE)),
):
    return await ConsultationService(db).get_by_id(consultation_id)


@router.patch("/{consultation_id}", response_model=ConsultationResponse)
async def update_consultation(
    consultation_id: uuid.UUID,
    data: ConsultationUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.CONSULTATION_MANAGE)),
):
    return await ConsultationService(db).update_status(consultation_id, data)
