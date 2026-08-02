import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from repositories.app_setting_repository import AppSettingRepository
from repositories.password_reset_token_repository import PasswordResetTokenRepository
from repositories.user_repository import UserRepository
from schemas.user import UserRegister
from core.security import (
    create_access_token,
    decode_token_allow_expired,
    get_password_hash,
    hash_refresh_token,
    verify_password,
)
from exceptions.general import BadRequestException, ConflictException, ForbiddenException, UnauthorizedException


class AuthService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)
        self.token_repo = PasswordResetTokenRepository(db)
        self.setting_repo = AppSettingRepository(db)

    async def login(self, email: str, password: str) -> str:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedException("Email o contraseña incorrectos")
        if not user.is_active:
            raise UnauthorizedException("Usuario inactivo")
        return create_access_token(subject=str(user.id), claims={"role": user.role.value})

    async def refresh(self, token: str) -> str:
        payload = decode_token_allow_expired(token)
        user_id = payload.get("sub")
        issued_at = payload.get("iat")
        if not user_id or issued_at is None:
            raise UnauthorizedException("Token inválido")

        session_age_seconds = datetime.now(timezone.utc).timestamp() - issued_at
        if session_age_seconds > settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400:
            raise UnauthorizedException("La sesión expiró, iniciá sesión nuevamente")

        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise UnauthorizedException("Token inválido")

        user = await self.repo.get_by_id(user_uuid)
        if not user or not user.is_active:
            raise UnauthorizedException("Usuario no encontrado o inactivo")

        return create_access_token(
            subject=str(user.id),
            claims={"role": user.role.value},
            issued_at=datetime.fromtimestamp(issued_at, tz=timezone.utc),
        )

    async def register(self, data: UserRegister) -> str:
        enabled = await self.setting_repo.get_value("registration_enabled")
        if enabled != "true":
            raise ForbiddenException("El registro de nuevas cuentas no está habilitado")

        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictException("Ya existe una cuenta con ese email")

        user = await self.repo.create_self_registered(
            nombre=data.nombre,
            apellido=data.apellido,
            email=str(data.email),
            password=data.password,
        )
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
