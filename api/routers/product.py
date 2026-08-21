import io
import uuid
from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from core.uploads import save_product_image
from dependencies.auth import has_role
from exceptions.general import BadRequestException
from services.product_service import ProductService
from services.product_export_service import ProductExportService
from services.product_import_service import ProductImportService
from schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductVariantCreate,
    ProductVariantUpdate,
    ProductVariantResponse,
    ImportReport,
)

router = APIRouter(prefix=f"{settings.API_V1_STR}/products", tags=["products"])

# A CSV catalog is plain text with tiny per-row payloads (unlike the image
# upload cap in core/uploads.py) — even tens of thousands of rows stay a few
# MB, so this is generous headroom, not a tight fit, while still guarding
# against loading a multi-hundred-MB upload fully into memory.
MAX_IMPORT_CSV_BYTES = 15 * 1024 * 1024  # 15MB


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    category_id: uuid.UUID | None = Query(default=None),
    made_to_order: bool | None = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    return await ProductService(db).get_all(
        category_id=category_id,
        made_to_order=made_to_order,
        skip=skip,
        limit=limit,
    )


@router.post("/", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await ProductService(db).create(data)


@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    url = await save_product_image(file)
    return {"url": url}


@router.get("/export")  # MUST be declared before GET /{product_id} — "export" is not a UUID
async def export_products(
    category_id: uuid.UUID | None = Query(default=None),
    made_to_order: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    csv_text = await ProductExportService(db).build_csv(category_id, made_to_order)
    return StreamingResponse(
        io.BytesIO(csv_text.encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="catalogo.csv"'},
    )


@router.post("/import", response_model=ImportReport)
async def import_products(
    file: UploadFile = File(...),
    dry_run: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    raw = await file.read()
    if len(raw) > MAX_IMPORT_CSV_BYTES:
        raise BadRequestException("El archivo CSV no puede superar los 15MB")

    report = await ProductImportService(db).run(raw, dry_run=dry_run)
    if dry_run:
        await db.rollback()  # get_db() commits on normal return — rollback here undoes it for a simulation
    return report


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    return await ProductService(db).get_by_id(product_id)


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await ProductService(db).update(product_id, data)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    await ProductService(db).delete(product_id)


@router.post("/{product_id}/variants", response_model=ProductVariantResponse, status_code=201)
async def create_variant(
    product_id: uuid.UUID,
    data: ProductVariantCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await ProductService(db).create_variant(product_id, data)


@router.patch("/variants/{variant_id}", response_model=ProductVariantResponse)
async def update_variant(
    variant_id: uuid.UUID,
    data: ProductVariantUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    return await ProductService(db).update_variant(variant_id, data)


@router.delete("/variants/{variant_id}", status_code=204)
async def delete_variant(
    variant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role(Permission.PRODUCT_MANAGE)),
):
    await ProductService(db).delete_variant(variant_id)
