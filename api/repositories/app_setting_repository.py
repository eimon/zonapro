from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.app_setting import AppSetting


class AppSettingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_value(self, key: str) -> str | None:
        result = await self.db.execute(
            select(AppSetting).where(AppSetting.key == key)
        )
        setting = result.scalars().first()
        return setting.value if setting else None

    async def set_value(self, key: str, value: str) -> AppSetting:
        result = await self.db.execute(
            select(AppSetting).where(AppSetting.key == key)
        )
        setting = result.scalars().first()
        if setting:
            setting.value = value
        else:
            setting = AppSetting(key=key, value=value)
            self.db.add(setting)
        await self.db.flush()
        await self.db.refresh(setting)
        return setting
