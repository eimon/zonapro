import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import get_current_user, has_role
from services.user_service import UserService
from schemas.user import UserCreate, UserUpdate, UserResponse
from models.user import User

router = APIRouter(prefix=f"{settings.API_V1_STR}/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(has_role(Permission.USER_MANAGE)),
):
    return await UserService(db).get_all(skip=skip, limit=limit)


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(has_role(Permission.USER_MANAGE)),
):
    return await UserService(db).create(data)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(has_role(Permission.USER_MANAGE)),
):
    return await UserService(db).update(user_id, data)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(has_role(Permission.USER_MANAGE)),
):
    await UserService(db).delete(user_id)
