from sqlalchemy.ext.asyncio import AsyncSession
from repositories.user_repository import UserRepository
from core.security import verify_password, create_access_token
from exceptions.general import UnauthorizedException


class AuthService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)

    async def login(self, email: str, password: str) -> str:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedException("Email o contraseña incorrectos")
        if not user.is_active:
            raise UnauthorizedException("Usuario inactivo")
        return create_access_token(subject=str(user.id), claims={"role": user.role.value})
