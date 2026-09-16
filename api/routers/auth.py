from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from dependencies.auth import get_current_user, verify_client
from services.auth_service import AuthService
from schemas.password_reset import SetPasswordRequest
from schemas.user import ChangePasswordRequest, RefreshRequest, TokenResponse, UserRegister
from models.user import User

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


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: UserRegister,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    token = await service.register(data)
    return TokenResponse(access_token=token)


@router.post("/set-password", status_code=204)
async def set_password(
    data: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await AuthService(db).set_password(data.token, data.new_password)


@router.post("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await AuthService(db).change_password(current_user, data.current_password, data.new_password)
