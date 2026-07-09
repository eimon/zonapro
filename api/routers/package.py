import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import has_role
from services.package_service import PackageService
from schemas.package import PackageCreate, PackageUpdate, PackageResponse

router = APIRouter(prefix=f"{settings.API_V1_STR}/packages", tags=["packages"])


@router.get("/", response_model=list[PackageResponse])
async def list_packages(db: AsyncSession = Depends(get_db)):
    return await PackageService(db).get_all()


@router.post("/", response_model=PackageResponse, status_code=201)
async def create_package(
    data: PackageCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PACKAGE_MANAGE)),
):
    return await PackageService(db).create(data)


@router.get("/{package_id}", response_model=PackageResponse)
async def get_package(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    return await PackageService(db).get_by_id(package_id)


@router.patch("/{package_id}", response_model=PackageResponse)
async def update_package(
    package_id: uuid.UUID,
    data: PackageUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PACKAGE_MANAGE)),
):
    return await PackageService(db).update(package_id, data)


@router.delete("/{package_id}", status_code=204)
async def delete_package(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PACKAGE_MANAGE)),
):
    await PackageService(db).delete(package_id)
