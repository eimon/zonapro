import uuid
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator
from models.enums import PackagePricingMode, PackageItemKind, IvaRate, Currency


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
    # Per-currency unit/line prices — IVA-inclusive (gross) and NET, mirroring
    # ProductVariantResponse.final_price_ars/usd. None when the item's variant
    # has no price in that currency.
    unit_price_ars: Optional[Decimal] = None
    unit_price_net_ars: Optional[Decimal] = None
    line_total_ars: Optional[Decimal] = None
    line_total_net_ars: Optional[Decimal] = None
    unit_price_usd: Optional[Decimal] = None
    unit_price_net_usd: Optional[Decimal] = None
    line_total_usd: Optional[Decimal] = None
    line_total_net_usd: Optional[Decimal] = None
    # float, not Decimal — mirrors QuoteItemResponse.quantity: Pydantic
    # serializes Decimal as a JSON string, and the web consumes it as a number.
    quantity: float
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


class PackagePriceInfo(BaseModel):
    """Computed, read-time-only pricing for one currency. Present in
    PackageResponse.prices[currency] only when the package is available in
    that currency (every item priced in it, and — for final_price mode — a
    pricing_value set for it)."""

    list_price: Decimal
    list_price_net: Decimal
    final_price: Decimal
    final_price_net: Decimal
    discount_percent: Decimal


class PackageCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool = True
    pricing_mode: PackagePricingMode
    # Exactly one pricing shape applies, matching pricing_mode — validated
    # service-side (bounds always depend on live catalog data):
    #   - discount_percent mode: `discount_percent` only (0-100, exclusive),
    #     applies to both currencies alike.
    #   - final_price mode: `pricing_value_ars` and/or `pricing_value_usd` —
    #     at least one, each < that currency's list price.
    discount_percent: Optional[Decimal] = None
    pricing_value_ars: Optional[Decimal] = None
    pricing_value_usd: Optional[Decimal] = None
    items: list[PackageItemCreate] = Field(min_length=1)


class PackageUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    pricing_mode: Optional[PackagePricingMode] = None
    discount_percent: Optional[Decimal] = None
    pricing_value_ars: Optional[Decimal] = None
    pricing_value_usd: Optional[Decimal] = None
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
    discount_percent: Optional[Decimal]
    pricing_value_ars: Optional[Decimal]
    pricing_value_usd: Optional[Decimal]
    # Computed at read time from live catalog prices — never stored. Keyed by
    # Currency ("ARS"/"USD"); a currency the package isn't available in maps
    # to None instead of being omitted, so the web can always do
    # `pkg.prices[currency]` without a membership check.
    prices: dict[Currency, Optional[PackagePriceInfo]]
    # True when available in at least one currency — items exist, every item's
    # variant/parent is active and not soft-deleted, matching prices[*] not
    # all being None.
    is_available: bool
    items: list[PackageItemResponse]

    model_config = {"from_attributes": True}
