import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.user import User
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
        obj = User(
            nombre=data.nombre,
            apellido=data.apellido,
            email=data.email,
            role=data.role,
            hashed_password=get_password_hash(data.password),
            is_active=True,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

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
