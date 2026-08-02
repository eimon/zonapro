import uuid
from decimal import Decimal
from pydantic import BaseModel


class ProductVariantCreate(BaseModel):
    sku: str
    name: str
    attributes: dict | None = None
    price: Decimal | None = None
    stock_qty: int = 0


class ProductVariantUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    attributes: dict | None = None
    price: Decimal | None = None
    stock_qty: int | None = None


class ProductVariantResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    sku: str
    name: str
    attributes: dict | None
    price: Decimal | None
    stock_qty: int

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    base_price: Decimal = Decimal("0")
    image_url: str | None = None
    made_to_order: bool = False
    category_id: uuid.UUID | None = None
    is_active: bool = True
    variants: list[ProductVariantCreate] = []


class ProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    base_price: Decimal | None = None
    image_url: str | None = None
    made_to_order: bool | None = None
    category_id: uuid.UUID | None = None
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    base_price: Decimal
    image_url: str | None
    made_to_order: bool
    category_id: uuid.UUID | None
    is_active: bool
    variants: list[ProductVariantResponse] = []

    model_config = {"from_attributes": True}
