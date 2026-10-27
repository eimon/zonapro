import secrets
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.user import User, UserRole
from schemas.user import UserCreate, UserUpdate
from core.security import get_password_hash
from repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: AsyncSession):
        super().__init__(User, db)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalars().first()

    async def create(self, data: UserCreate) -> User:
        # La contraseña real la define el usuario vía el link de invitación;
        # esta es solo un placeholder aleatorio que nunca se revela.
        obj = User(
            nombre=data.nombre,
            apellido=data.apellido,
            email=data.email,
            role=data.role,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            is_active=True,
            must_change_password=True,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def restore_for_invite(self, user: User, data: UserCreate) -> User:
        # Reactiva un usuario eliminado como invitación pendiente; la contraseña
        # anterior se descarta y se reemplaza por un placeholder aleatorio.
        user.deleted_at = None
        user.is_active = True
        user.must_change_password = True
        user.nombre = data.nombre
        user.apellido = data.apellido
        user.role = data.role
        user.hashed_password = get_password_hash(secrets.token_urlsafe(32))
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def get_deleted(self, skip: int = 0, limit: int = 100) -> list[User]:
        result = await self.db.execute(
            select(User)
            .where(User.deleted_at.is_not(None))
            .order_by(User.deleted_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def restore(self, user: User) -> User:
        # Devuelve al usuario tal como estaba: contraseña, rol y estado de
        # invitación se mantienen.
        user.deleted_at = None
        user.is_active = True
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def create_self_registered(
        self, nombre: str, apellido: str, email: str, password: str
    ) -> User:
        obj = User(
            nombre=nombre,
            apellido=apellido,
            email=email,
            role=UserRole.CLIENTE,
            hashed_password=get_password_hash(password),
            is_active=True,
            must_change_password=False,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def set_password(self, user: User, hashed_password: str) -> None:
        user.hashed_password = hashed_password
        user.must_change_password = False
        await self.db.flush()
        await self.db.refresh(user)

    async def update(self, id: uuid.UUID, data: UserUpdate) -> User | None:
        obj = await self.get_by_id(id)
        if not obj:
            return None
        update_data = data.model_dump(exclude_unset=True)
        if "password" in update_data:
            obj.hashed_password = get_password_hash(update_data.pop("password"))
        for key, value in update_data.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj
