from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from dependencies.auth import verify_client
from services.auth_service import AuthService
from schemas.user import TokenResponse

router = APIRouter(prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(verify_client),
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    token = await service.login(form_data.username, form_data.password)
    return TokenResponse(access_token=token)
