import uuid
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import role_hierarchy
from repositories.user_repository import UserRepository
from models.user import User
from exceptions.general import UnauthorizedException, ForbiddenException

oauth2_bearer = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


def verify_client(form_data: OAuth2PasswordRequestForm = Depends()) -> OAuth2PasswordRequestForm:
    expected_secret = settings.ALLOWED_CLIENTS.get(form_data.client_id or "")
    if expected_secret is None or expected_secret != (form_data.client_secret or ""):
        raise UnauthorizedException("Cliente no autorizado")
    return form_data


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_bearer),
) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise UnauthorizedException("Token inválido")
    except JWTError:
        raise UnauthorizedException("Token inválido")

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise UnauthorizedException("ID de usuario inválido en token")

    repo = UserRepository(db)
    user = await repo.get_by_id(user_uuid)

    if user is None or not user.is_active:
        raise UnauthorizedException("Usuario no encontrado o inactivo")

    user.permissions = role_hierarchy.get(user.role.value.upper(), [])
    return user


def has_role(required_permission: str):
    async def dependency(user: User = Depends(get_current_user)):
        if required_permission not in user.permissions:
            raise ForbiddenException("No autorizado para esta acción")
        return user
    return dependency


_optional_bearer = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(_optional_bearer),
) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user_uuid = uuid.UUID(user_id)
    except Exception:
        return None

    repo = UserRepository(db)
    user = await repo.get_by_id(user_uuid)
    if user is None or not user.is_active:
        return None

    user.permissions = role_hierarchy.get(user.role.value.upper(), [])
    return user
