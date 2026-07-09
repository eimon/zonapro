import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.user_repository import UserRepository
from schemas.user import UserCreate, UserUpdate
from models.user import User
from exceptions.general import NotFoundException, ConflictException


class UserService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)

    async def create(self, data: UserCreate) -> User:
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictException("Ya existe un usuario con ese email")
        return await self.repo.create(data)

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
