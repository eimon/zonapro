import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.email import send_invite_email
from core.security import generate_refresh_token
from repositories.password_reset_token_repository import PasswordResetTokenRepository
from repositories.user_repository import UserRepository
from schemas.user import UserCreate, UserUpdate
from models.user import User
from exceptions.general import NotFoundException, ConflictException


class UserService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)
        self.token_repo = PasswordResetTokenRepository(db)

    async def create(self, data: UserCreate) -> User:
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictException("Ya existe un usuario con ese email")

        user = await self.repo.create(data)

        raw_token, token_hash = generate_refresh_token()
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
        )
        await self.token_repo.create(user.id, token_hash, expires_at)

        set_password_url = f"{settings.FRONTEND_URL}/set-password?token={raw_token}"
        send_invite_email(user.email, user.nombre, user.role.value, set_password_url)

        return user

    async def get_by_id(self, id: uuid.UUID) -> User:
        user = await self.repo.get_by_id(id)
        if not user:
            raise NotFoundException("Usuario no encontrado")
        return user

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[User]:
        return await self.repo.get_all(skip=skip, limit=limit)

    async def update(self, id: uuid.UUID, data: UserUpdate) -> User:
        user = await self.repo.update(id, data)
        if not user:
            raise NotFoundException("Usuario no encontrado")
        return user

    async def delete(self, id: uuid.UUID) -> None:
        result = await self.repo.soft_delete(id)
        if not result:
            raise NotFoundException("Usuario no encontrado")
