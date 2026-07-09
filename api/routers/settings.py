from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import has_role
from repositories.quote_repository import AppSettingRepository

router = APIRouter(prefix=f"{settings.API_V1_STR}/settings", tags=["settings"])


class HourlyRateResponse(BaseModel):
    key: str
    value: str


class HourlyRateUpdate(BaseModel):
    value: str


@router.get("/hourly-rate", response_model=HourlyRateResponse)
async def get_hourly_rate(db: AsyncSession = Depends(get_db)):
    repo = AppSettingRepository(db)
    value = await repo.get_value("hourly_rate")
    return HourlyRateResponse(key="hourly_rate", value=value or "0")


@router.patch("/hourly-rate", response_model=HourlyRateResponse)
async def set_hourly_rate(
    data: HourlyRateUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(has_role(Permission.SETTINGS_MANAGE)),
):
    repo = AppSettingRepository(db)
    setting = await repo.set_value("hourly_rate", data.value)
    return HourlyRateResponse(key=setting.key, value=setting.value)
