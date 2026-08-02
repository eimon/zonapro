from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from dependencies.auth import verify_client
from services.auth_service import AuthService
from schemas.password_reset import SetPasswordRequest
from schemas.user import RefreshRequest, TokenResponse

router = APIRouter(prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(verify_client),
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    token = await service.login(form_data.username, form_data.password)
    return TokenResponse(access_token=token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    token = await service.refresh(data.token)
    return TokenResponse(access_token=token)


@router.post("/set-password", status_code=204)
async def set_password(
    data: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await AuthService(db).set_password(data.token, data.new_password)
