import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import has_role
from services.category_service import CategoryService
from schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix=f"{settings.API_V1_STR}/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    return await CategoryService(db).get_all(skip=skip, limit=limit)


@router.post("/", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await CategoryService(db).create(data)


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    return await CategoryService(db).get_by_id(category_id)


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await CategoryService(db).update(category_id, data)


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    await CategoryService(db).delete(category_id)
