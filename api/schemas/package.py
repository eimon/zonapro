import uuid
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator
from models.enums import PackagePricingMode, PackageItemKind, IvaRate


class PackageItemCreate(BaseModel):
    kind: PackageItemKind
    display_order: int = 0
    product_variant_id: Optional[uuid.UUID] = None
    supply_variant_id: Optional[uuid.UUID] = None
    quantity: Decimal = Field(gt=0, max_digits=10, decimal_places=2)

    @model_validator(mode="after")
    def variant_matches_kind(self) -> "PackageItemCreate":
        if self.kind == PackageItemKind.product:
            if self.product_variant_id is None or self.supply_variant_id is not None:
                raise ValueError("Un ítem de producto debe indicar únicamente product_variant_id")
            # Products are always whole units — fractional quantities only
            # make sense for supplies (meters of cable, liters…), mirroring
            # QuoteItemCreate.product_quantity_is_whole.
            if self.quantity != self.quantity.to_integral_value():
                raise ValueError("La cantidad de un producto debe ser un número entero")
        else:
            if self.supply_variant_id is None or self.product_variant_id is not None:
                raise ValueError("Un ítem de insumo debe indicar únicamente supply_variant_id")
        return self


class PackageItemResponse(BaseModel):
    id: uuid.UUID
    kind: PackageItemKind
    display_order: int
    product_variant_id: Optional[uuid.UUID]
    supply_variant_id: Optional[uuid.UUID]
    # "Product — Variant" / "Supply — Variant", built server-side from the
    # live catalog (never snapshotted, unlike QuoteItem).
    name: str
    sku: str
    # The parent product's/supply's IVA rate — lets the dashboard recompute
    # gross previews client-side without re-deriving it from unit_price/
    # unit_price_net.
    iva_rate: IvaRate
    # IVA-inclusive (gross) — the customer-facing unit price/subtotal.
    unit_price: Decimal
    # NET (no IVA) — the stored/pricing basis, shown as the muted "sin
    # impuestos" detail.
    unit_price_net: Decimal
    # float, not Decimal — mirrors QuoteItemResponse.quantity: Pydantic
    # serializes Decimal as a JSON string, and the web consumes it as a number.
    quantity: float
    line_total: Decimal
    line_total_net: Decimal
    # The parent product's/supply's image_url (never the variant's — images
    # live one level up in both catalogs). None when the parent has no image.
    image_url: Optional[str] = None
    # The parent product's category slug — None for supply items and for
    # products without a category. Used by the storefront to decide whether
    # a package's promo card should show under an active category filter.
    category_slug: Optional[str] = None
    # The parent product's id — None for supply items. Lets the package
    # detail page link a product row to its own /productos/{id} page.
    product_id: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}


class PackageCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool = True
    pricing_mode: PackagePricingMode
    # Bounds (>0, and <100 for discount_percent / <list_price for
    # final_price) are enforced service-side with Spanish messages — see
    # PackageService._validate_pricing — rather than via Field() here, since
    # the upper bound always depends on live catalog data anyway.
    pricing_value: Decimal
    items: list[PackageItemCreate] = Field(min_length=1)


class PackageUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    pricing_mode: Optional[PackagePricingMode] = None
    pricing_value: Optional[Decimal] = None
    # When provided, replaces the package's items wholesale (delete-all +
    # re-create). When absent, existing items are left untouched.
    items: Optional[list[PackageItemCreate]] = None


class PackageResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str]
    is_active: bool
    pricing_mode: PackagePricingMode
    pricing_value: Decimal
    # Computed at read time from live catalog prices — never stored.
    # IVA-inclusive (gross) — the customer-facing prices shown as the main
    # price everywhere in the storefront and dashboard.
    list_price: Decimal
    final_price: Decimal
    # NET (no IVA) — the stored/pricing basis. pricing_value/pricing_mode and
    # the >list_price / <100% validation rules always work in these terms.
    # final_price_net is also what's shown as the muted "sin impuestos" detail.
    list_price_net: Decimal
    final_price_net: Decimal
    discount_percent: Decimal
    # All items' variants (and their parent product/supply) are active and
    # not soft-deleted. A package with a discontinued item is unavailable
    # even if is_active is still true.
    is_available: bool
    items: list[PackageItemResponse]

    model_config = {"from_attributes": True}
