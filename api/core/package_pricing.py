from decimal import Decimal, ROUND_HALF_UP
from models.package import Package, PackageItem
from models.enums import PackagePricingMode, PackageItemKind

TWO_PLACES = Decimal("0.01")


def item_variant(item: PackageItem):
    """The catalog variant this item points to — a ProductVariant or a
    SupplyVariant, whichever `kind` selects."""
    return item.product_variant if item.kind == PackageItemKind.product else item.supply_variant


def item_parent(item: PackageItem):
    """The variant's parent Product or Supply — where `iva_rate` lives."""
    variant = item_variant(item)
    if variant is None:
        return None
    return variant.product if item.kind == PackageItemKind.product else variant.supply


def item_iva_rate(item: PackageItem) -> Decimal:
    """The IVA rate (as a percentage, e.g. Decimal("21")) of this item's
    parent product/supply. 0 when the parent can't be resolved."""
    parent = item_parent(item)
    if parent is None:
        return Decimal("0")
    return Decimal(parent.iva_rate.value)


def item_unit_price_net(item: PackageItem) -> Decimal:
    """Live catalog NET price for this item's variant. Prices are never
    snapshotted — a package's list price always reflects current catalog
    prices, unlike QuoteItem which snapshots at creation time."""
    variant = item_variant(item)
    return variant.price if variant is not None else Decimal("0")


def item_unit_price_gross(item: PackageItem) -> Decimal:
    """NET price with the item's own IVA rate applied — mirrors
    ProductVariantResponse.final_price / SupplyVariantResponse.final_price."""
    net = item_unit_price_net(item)
    rate = item_iva_rate(item)
    return (net * (Decimal("1") + rate / Decimal("100"))).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def item_line_total_net(item: PackageItem) -> Decimal:
    return (item_unit_price_net(item) * item.quantity).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def item_line_total_gross(item: PackageItem) -> Decimal:
    return (item_unit_price_gross(item) * item.quantity).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def package_list_price_net(package: Package) -> Decimal:
    return sum((item_line_total_net(item) for item in package.items), Decimal("0.00"))


def package_list_price_gross(package: Package) -> Decimal:
    return sum((item_line_total_gross(item) for item in package.items), Decimal("0.00"))


def compute_final_price_and_discount(
    list_price_net: Decimal, pricing_mode: PackagePricingMode, pricing_value: Decimal
) -> tuple[Decimal, Decimal]:
    """Given the fixed admin choice (pricing_mode + pricing_value) and the
    current NET list price, derives whichever of (final_price, discount_percent)
    wasn't chosen directly. Both are rounded to cents / 2 decimals. Pricing
    (the admin's input, validation bounds, and this computation) always works
    in NET terms — IVA-inclusive prices are derived from the result, never
    stored or validated directly."""
    if list_price_net <= 0:
        return Decimal("0.00"), Decimal("0.00")

    if pricing_mode == PackagePricingMode.final_price:
        final_price_net = pricing_value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        discount_percent = ((Decimal("1") - final_price_net / list_price_net) * Decimal("100")).quantize(
            TWO_PLACES, rounding=ROUND_HALF_UP
        )
    else:
        discount_percent = pricing_value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        final_price_net = (list_price_net * (Decimal("1") - pricing_value / Decimal("100"))).quantize(
            TWO_PLACES, rounding=ROUND_HALF_UP
        )
    return final_price_net, discount_percent


def compute_final_price_gross(
    list_price_net: Decimal, list_price_gross: Decimal, final_price_net: Decimal
) -> Decimal:
    """Applies the same discount factor implied by (final_price_net /
    list_price_net) to the gross list price — this is what makes the gross
    final price correct even when items mix different IVA rates (21% +
    10.5%), instead of naively re-adding a single IVA rate on top of
    final_price_net."""
    if list_price_net <= 0:
        return Decimal("0.00")
    return (final_price_net * list_price_gross / list_price_net).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def item_is_available(item: PackageItem) -> bool:
    """An item is available when its variant exists, isn't soft-deleted, and
    its parent product/supply is active and not soft-deleted."""
    variant = item_variant(item)
    if variant is None or variant.deleted_at is not None:
        return False
    parent = variant.product if item.kind == PackageItemKind.product else variant.supply
    if parent is None or parent.deleted_at is not None or not parent.is_active:
        return False
    return True


def package_is_available(package: Package) -> bool:
    """A package is only offerable when it has items and every item is
    available — one discontinued/inactive item pulls the whole package."""
    if not package.items:
        return False
    return all(item_is_available(item) for item in package.items)
