import io
import uuid
from typing import Literal
from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import has_role
from exceptions.general import BadRequestException
from services.supply_service import SupplyService
from services.supply_export_service import SupplyExportService
from services.supply_import_service import SupplyImportService
from schemas.supply import (
    SupplyCreate,
    SupplyUpdate,
    SupplyResponse,
    SupplyVariantCreate,
    SupplyVariantUpdate,
    SupplyVariantResponse,
    SupplyImportReport,
)

router = APIRouter(prefix=f"{settings.API_V1_STR}/supplies", tags=["supplies"])

# Mirrors MAX_IMPORT_CSV_BYTES in routers/product.py — same rationale: a CSV
# catalog is plain text with tiny per-row payloads, so 15MB is generous
# headroom, not a tight fit, while still guarding against loading a
# multi-hundred-MB upload fully into memory.
MAX_IMPORT_CSV_BYTES = 15 * 1024 * 1024  # 15MB


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


@router.get("/export")  # MUST be declared before GET /{supply_id} — "export" is not a UUID
async def export_supplies(
    delimiter: Literal[",", ";"] = Query(default=","),
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    csv_text = await SupplyExportService(db).build_csv(delimiter=delimiter)
    return StreamingResponse(
        io.BytesIO(csv_text.encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="insumos.csv"'},
    )


@router.post("/import", response_model=SupplyImportReport)
async def import_supplies(
    file: UploadFile = File(...),
    dry_run: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    raw = await file.read()
    if len(raw) > MAX_IMPORT_CSV_BYTES:
        raise BadRequestException("El archivo CSV no puede superar los 15MB")

    report = await SupplyImportService(db).run(raw, dry_run=dry_run)
    if dry_run:
        await db.rollback()  # get_db() commits on normal return — rollback here undoes it for a simulation
    return report


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
