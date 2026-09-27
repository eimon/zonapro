import uuid
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, model_validator
from models.enums import IvaRate
from schemas.catalog import CatalogCategoryRef


class ProductVariantCreate(BaseModel):
    sku: str
    name: str
    attributes: dict | None = None
    # Prices are independent, manually-edited values per currency — never
    # auto-converted. At least one of the two is required.
    price_ars: Decimal | None = None
    price_usd: Decimal | None = None
    price_input_mode: Literal["net", "final"] = "net"
    stock_qty: int = 0

    @model_validator(mode="after")
    def at_least_one_price(self) -> "ProductVariantCreate":
        if self.price_ars is None and self.price_usd is None:
            raise ValueError("Debés indicar al menos un precio (ARS o USD)")
        return self


class ProductVariantUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    attributes: dict | None = None
    price_ars: Decimal | None = None
    price_usd: Decimal | None = None
    price_input_mode: Literal["net", "final"] = "net"
    stock_qty: int | None = None


class ProductVariantResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    sku: str
    name: str
    attributes: dict | None
    price_ars: Decimal | None
    price_usd: Decimal | None
    stock_qty: int
    final_price_ars: Decimal | None
    final_price_usd: Decimal | None

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    iva_rate: IvaRate
    image_url: str | None = None
    made_to_order: bool = False
    category_id: uuid.UUID | None = None
    is_active: bool = True
    variants: list[ProductVariantCreate] = Field(min_length=1)


class ProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    iva_rate: IvaRate | None = None
    image_url: str | None = None
    made_to_order: bool | None = None
    category_id: uuid.UUID | None = None
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    iva_rate: IvaRate
    image_url: str | None
    made_to_order: bool
    category_id: uuid.UUID | None
    # Nested category slug/name for the storefront (breadcrumb links, spec
    # table). None when the product has no category.
    category: CatalogCategoryRef | None = None
    is_active: bool
    variants: list[ProductVariantResponse] = []

    model_config = {"from_attributes": True}


class ImportRowError(BaseModel):
    row_number: int | None = None  # None = group-level error
    identifier: str | None = None  # slug or sku
    message: str


class ImportReport(BaseModel):
    dry_run: bool
    rows_processed: int
    products_created: int
    products_updated: int
    variants_created: int
    variants_updated: int
    errors: list[ImportRowError] = []
