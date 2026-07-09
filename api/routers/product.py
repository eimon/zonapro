import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.database import get_db
from core.roles import Permission
from dependencies.auth import has_role
from services.product_service import ProductService
from schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductVariantCreate,
    ProductVariantUpdate,
    ProductVariantResponse,
)

router = APIRouter(prefix=f"{settings.API_V1_STR}/products", tags=["products"])


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
