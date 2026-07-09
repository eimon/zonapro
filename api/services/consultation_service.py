import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.consultation_repository import ConsultationRepository
from schemas.consultation import ConsultationCreate, ConsultationUpdate
from models.consultation import Consultation
from exceptions.general import NotFoundException


class ConsultationService:
    def __init__(self, db: AsyncSession):
        self.repo = ConsultationRepository(db)

    async def create(self, data: ConsultationCreate, user_id: uuid.UUID | None) -> Consultation:
        return await self.repo.create(
            name=data.name,
            email=str(data.email),
            phone=data.phone,
            type=data.type,
            message=data.message,
            product_id=data.product_id,
            package_id=data.package_id,
            selected_options=data.selected_options,
            user_id=user_id,
        )

    async def get_all(self) -> list[Consultation]:
        return await self.repo.get_all_ordered()

    async def get_by_id(self, id: uuid.UUID) -> Consultation:
        obj = await self.repo.get_by_id(id)
        if not obj or obj.deleted_at is not None:
            raise NotFoundException("Consulta no encontrada")
        return obj

    async def update_status(self, id: uuid.UUID, data: ConsultationUpdate) -> Consultation:
        obj = await self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)
        return await self.repo.update(obj, **update_data)
