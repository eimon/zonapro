from sqlalchemy.ext.asyncio import AsyncSession
from repositories.password_reset_token_repository import PasswordResetTokenRepository
from repositories.user_repository import UserRepository
from core.security import create_access_token, get_password_hash, hash_refresh_token, verify_password
from exceptions.general import BadRequestException, UnauthorizedException


class AuthService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)
        self.token_repo = PasswordResetTokenRepository(db)

    async def login(self, email: str, password: str) -> str:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedException("Email o contraseña incorrectos")
        if not user.is_active:
            raise UnauthorizedException("Usuario inactivo")
        return create_access_token(subject=str(user.id), claims={"role": user.role.value})

    async def set_password(self, token: str, new_password: str) -> None:
        token_hash = hash_refresh_token(token)
        reset_token = await self.token_repo.get_valid_by_hash(token_hash)
        if not reset_token:
            raise BadRequestException("El enlace no es válido o expiró")

        user = await self.repo.get_by_id(reset_token.user_id)
        if not user:
            raise BadRequestException("El enlace no es válido o expiró")

        await self.repo.set_password(user, get_password_hash(new_password))
        await self.token_repo.mark_used(reset_token)
