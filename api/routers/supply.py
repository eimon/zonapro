import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import has_role
from services.supply_service import SupplyService
from schemas.supply import (
    SupplyCreate,
    SupplyUpdate,
    SupplyResponse,
    SupplyVariantCreate,
    SupplyVariantUpdate,
    SupplyVariantResponse,
)

router = APIRouter(prefix=f"{settings.API_V1_STR}/supplies", tags=["supplies"])


@router.get("/", response_model=list[SupplyResponse])
async def list_supplies(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await SupplyService(db).get_all(skip=skip, limit=limit)


@router.post("/", response_model=SupplyResponse, status_code=201)
async def create_supply(
    data: SupplyCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await SupplyService(db).create(data)


@router.get("/{supply_id}", response_model=SupplyResponse)
async def get_supply(
    supply_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await SupplyService(db).get_by_id(supply_id)


@router.patch("/{supply_id}", response_model=SupplyResponse)
async def update_supply(
    supply_id: uuid.UUID,
    data: SupplyUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await SupplyService(db).update(supply_id, data)


@router.delete("/{supply_id}", status_code=204)
async def delete_supply(
    supply_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    await SupplyService(db).delete(supply_id)


@router.post("/{supply_id}/variants", response_model=SupplyVariantResponse, status_code=201)
async def create_variant(
    supply_id: uuid.UUID,
    data: SupplyVariantCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await SupplyService(db).create_variant(supply_id, data)


@router.patch("/variants/{variant_id}", response_model=SupplyVariantResponse)
async def update_variant(
    variant_id: uuid.UUID,
    data: SupplyVariantUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await SupplyService(db).update_variant(variant_id, data)


@router.delete("/variants/{variant_id}", status_code=204)
async def delete_variant(
    variant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    await SupplyService(db).delete_variant(variant_id)
