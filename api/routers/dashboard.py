from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import has_role
from schemas.dashboard import DashboardStats
from services.dashboard_service import DashboardService

router = APIRouter(prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    # Business-wide aggregate — ADMIN-only in this first version. VENDEDOR
    # only has QUOTE_VIEW_OWN and should not see numbers across all vendors.
    _=Depends(has_role(Permission.QUOTE_VIEW_ALL)),
):
    return await DashboardService(db).get_stats()
