import uuid
from decimal import Decimal
from pydantic import BaseModel
from models.enums import PackageComplexity


class PackageOptionCreate(BaseModel):
    label: str
    price_delta: Decimal = Decimal("0")
    is_default: bool = False
    display_order: int = 0


class PackageOptionResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    label: str
    price_delta: Decimal
    is_default: bool
    display_order: int

    model_config = {"from_attributes": True}


class PackageOptionGroupCreate(BaseModel):
    name: str
    display_order: int = 0
    options: list[PackageOptionCreate] = []


class PackageOptionGroupResponse(BaseModel):
    id: uuid.UUID
    package_id: uuid.UUID
    name: str
    display_order: int
    options: list[PackageOptionResponse]

    model_config = {"from_attributes": True}


class PackageCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    complexity: PackageComplexity
    base_price: Decimal = Decimal("0")
    is_active: bool = True
    option_groups: list[PackageOptionGroupCreate] = []


class PackageUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    complexity: PackageComplexity | None = None
    base_price: Decimal | None = None
    is_active: bool | None = None


class PackageResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    complexity: PackageComplexity
    base_price: Decimal
    is_active: bool
    option_groups: list[PackageOptionGroupResponse]

    model_config = {"from_attributes": True}
