import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.consultation import Consultation
from repositories.base import BaseRepository


class ConsultationRepository(BaseRepository[Consultation]):
    def __init__(self, db: AsyncSession):
        super().__init__(Consultation, db)

    async def get_all_ordered(self) -> list[Consultation]:
        result = await self.db.execute(
            select(Consultation)
            .where(Consultation.deleted_at.is_(None))
            .order_by(Consultation.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        name: str,
        email: str,
        phone: str | None,
        type,
        message: str | None,
        product_id: uuid.UUID | None,
        package_id: uuid.UUID | None,
        selected_options: dict,
        user_id: uuid.UUID | None,
    ) -> Consultation:
        obj = Consultation(
            name=name,
            email=email,
            phone=phone,
            type=type,
            message=message,
            product_id=product_id,
            package_id=package_id,
            selected_options=selected_options,
            user_id=user_id,
        )
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: Consultation, **kwargs) -> Consultation:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj
