import uuid
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, model_validator
from models.enums import IvaRate


class SupplyVariantCreate(BaseModel):
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
    def at_least_one_price(self) -> "SupplyVariantCreate":
        if self.price_ars is None and self.price_usd is None:
            raise ValueError("Debés indicar al menos un precio (ARS o USD)")
        return self


class SupplyVariantUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    attributes: dict | None = None
    price_ars: Decimal | None = None
    price_usd: Decimal | None = None
    price_input_mode: Literal["net", "final"] = "net"
    stock_qty: int | None = None


class SupplyVariantResponse(BaseModel):
    id: uuid.UUID
    supply_id: uuid.UUID
    sku: str
    name: str
    attributes: dict | None
    price_ars: Decimal | None
    price_usd: Decimal | None
    stock_qty: int
    final_price_ars: Decimal | None
    final_price_usd: Decimal | None

    model_config = {"from_attributes": True}


class SupplyCreate(BaseModel):
    name: str
    description: str | None = None
    iva_rate: IvaRate = IvaRate.iva_21
    image_url: str | None = None
    is_active: bool = True
    variants: list[SupplyVariantCreate] = Field(min_length=1)


class SupplyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    iva_rate: IvaRate | None = None
    image_url: str | None = None
    is_active: bool | None = None


class SupplyResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    iva_rate: IvaRate
    image_url: str | None
    is_active: bool
    variants: list[SupplyVariantResponse] = []

    model_config = {"from_attributes": True}


class ImportRowError(BaseModel):
    row_number: int | None = None  # None = group-level error
    identifier: str | None = None  # name or sku
    message: str


class SupplyImportReport(BaseModel):
    dry_run: bool
    rows_processed: int
    supplies_created: int
    supplies_updated: int
    variants_created: int
    variants_updated: int
    errors: list[ImportRowError] = []
