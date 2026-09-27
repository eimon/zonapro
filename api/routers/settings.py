from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import has_role
from models.enums import Currency
from repositories.app_setting_repository import AppSettingRepository

router = APIRouter(prefix=f"{settings.API_V1_STR}/settings", tags=["settings"])


class HourlyRateResponse(BaseModel):
    key: str
    currency: Currency
    value: str


class HourlyRateUpdate(BaseModel):
    value: str


def _hourly_rate_key(currency: Currency) -> str:
    return f"hourly_rate_{currency.value.lower()}"


# One rate per currency (D: hourly_rate_ars / hourly_rate_usd app_settings
# rows) — a servicios quote always uses the rate matching its own currency.
@router.get("/hourly-rate/{currency}", response_model=HourlyRateResponse)
async def get_hourly_rate(currency: Currency, db: AsyncSession = Depends(get_db)):
    repo = AppSettingRepository(db)
    key = _hourly_rate_key(currency)
    value = await repo.get_value(key)
    return HourlyRateResponse(key=key, currency=currency, value=value or "0")


@router.patch("/hourly-rate/{currency}", response_model=HourlyRateResponse)
async def set_hourly_rate(
    currency: Currency,
    data: HourlyRateUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(has_role(Permission.SETTINGS_MANAGE)),
):
    repo = AppSettingRepository(db)
    key = _hourly_rate_key(currency)
    setting = await repo.set_value(key, data.value)
    return HourlyRateResponse(key=setting.key, currency=currency, value=setting.value)


class RegistrationEnabledResponse(BaseModel):
    key: str
    enabled: bool


class RegistrationEnabledUpdate(BaseModel):
    enabled: bool


# Public: the self-registration page needs this to decide whether to show the form.
@router.get("/registration-enabled", response_model=RegistrationEnabledResponse)
async def get_registration_enabled(db: AsyncSession = Depends(get_db)):
    repo = AppSettingRepository(db)
    value = await repo.get_value("registration_enabled")
    return RegistrationEnabledResponse(key="registration_enabled", enabled=value == "true")


@router.patch("/registration-enabled", response_model=RegistrationEnabledResponse)
async def set_registration_enabled(
    data: RegistrationEnabledUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(has_role(Permission.SETTINGS_MANAGE)),
):
    repo = AppSettingRepository(db)
    setting = await repo.set_value("registration_enabled", "true" if data.enabled else "false")
    return RegistrationEnabledResponse(key=setting.key, enabled=setting.value == "true")


class ResendApiKeyResponse(BaseModel):
    key: str
    is_set: bool
    masked: str | None = None


class ResendApiKeyUpdate(BaseModel):
    value: str


def _mask_key(value: str) -> str:
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:4]}{'•' * 8}{value[-4:]}"


# Admin-only both ways: unlike other settings, this is a secret.
@router.get("/resend-api-key", response_model=ResendApiKeyResponse)
async def get_resend_api_key(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(has_role(Permission.SETTINGS_MANAGE)),
):
    repo = AppSettingRepository(db)
    value = await repo.get_value("resend_api_key")
    return ResendApiKeyResponse(
        key="resend_api_key", is_set=bool(value), masked=_mask_key(value) if value else None
    )


@router.patch("/resend-api-key", response_model=ResendApiKeyResponse)
async def set_resend_api_key(
    data: ResendApiKeyUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(has_role(Permission.SETTINGS_MANAGE)),
):
    repo = AppSettingRepository(db)
    setting = await repo.set_value("resend_api_key", data.value)
    return ResendApiKeyResponse(key=setting.key, is_set=True, masked=_mask_key(setting.value))
