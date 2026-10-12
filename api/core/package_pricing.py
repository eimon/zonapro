from decimal import Decimal, ROUND_HALF_UP
from models.package import Package, PackageItem
from models.enums import PackagePricingMode, PackageItemKind, Currency

TWO_PLACES = Decimal("0.01")
_PRICE_FIELD = {Currency.ARS: "price_ars", Currency.USD: "price_usd"}


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


def item_unit_price_net(item: PackageItem, currency: Currency) -> Decimal | None:
    """Live catalog NET price for this item's variant, in `currency`. Prices
    are never snapshotted — a package's list price always reflects current
    catalog prices, unlike QuoteItem which snapshots at creation time. None
    when the variant has no price set for that currency."""
    variant = item_variant(item)
    if variant is None:
        return None
    return getattr(variant, _PRICE_FIELD[currency])


def item_unit_price_gross(item: PackageItem, currency: Currency) -> Decimal | None:
    """NET price with the item's own IVA rate applied — mirrors
    ProductVariantResponse.final_price_ars/usd. None when the item has no
    price in that currency."""
    net = item_unit_price_net(item, currency)
    if net is None:
        return None
    rate = item_iva_rate(item)
    return (net * (Decimal("1") + rate / Decimal("100"))).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def item_line_total_net(item: PackageItem, currency: Currency) -> Decimal | None:
    net = item_unit_price_net(item, currency)
    if net is None:
        return None
    return (net * item.quantity).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def item_line_total_gross(item: PackageItem, currency: Currency) -> Decimal | None:
    gross = item_unit_price_gross(item, currency)
    if gross is None:
        return None
    return (gross * item.quantity).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def item_has_price(item: PackageItem, currency: Currency) -> bool:
    return item_unit_price_net(item, currency) is not None


def package_has_all_items_priced(package: Package, currency: Currency) -> bool:
    """A package is only priceable in `currency` when every item's variant
    has a price set for it — this is what "available in a currency" means
    for the items side (see also package_is_available_in_currency, which
    additionally requires each item to be catalog-available)."""
    return bool(package.items) and all(item_has_price(item, currency) for item in package.items)


def package_list_price_net(package: Package, currency: Currency) -> Decimal:
    return sum(
        (item_line_total_net(item, currency) or Decimal("0.00") for item in package.items),
        Decimal("0.00"),
    )


def package_list_price_gross(package: Package, currency: Currency) -> Decimal:
    return sum(
        (item_line_total_gross(item, currency) or Decimal("0.00") for item in package.items),
        Decimal("0.00"),
    )


def compute_final_price_and_discount(
    list_price_net: Decimal,
    pricing_mode: PackagePricingMode,
    discount_percent: Decimal | None,
    pricing_value: Decimal | None,
) -> tuple[Decimal, Decimal] | None:
    """Given the fixed admin choice and the current NET list price (for one
    currency), derives (final_price_net, discount_percent) for that currency.
    Both are rounded to cents / 2 decimals. Pricing (the admin's input,
    validation bounds, and this computation) always works in NET terms — IVA
    -inclusive prices are derived from the result, never stored or validated
    directly.

    Returns None when the currency can't be priced at all: discount_percent
    mode always can (as long as there's a list price), but final_price mode
    needs `pricing_value` set for this specific currency.
    """
    if list_price_net <= 0:
        return None

    if pricing_mode == PackagePricingMode.discount_percent:
        if discount_percent is None:
            return None
        discount = discount_percent.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        final_price_net = (list_price_net * (Decimal("1") - discount_percent / Decimal("100"))).quantize(
            TWO_PLACES, rounding=ROUND_HALF_UP
        )
        return final_price_net, discount

    # final_price mode
    if pricing_value is None:
        return None
    final_price_net = pricing_value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    discount = ((Decimal("1") - final_price_net / list_price_net) * Decimal("100")).quantize(
        TWO_PLACES, rounding=ROUND_HALF_UP
    )
    return final_price_net, discount


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


def item_is_catalog_available(item: PackageItem) -> bool:
    """An item is catalog-available when its variant exists, isn't
    soft-deleted, and its parent product/supply is active and not
    soft-deleted — independent of currency/pricing."""
    variant = item_variant(item)
    if variant is None or variant.deleted_at is not None:
        return False
    parent = variant.product if item.kind == PackageItemKind.product else variant.supply
    if parent is None or parent.deleted_at is not None or not parent.is_active:
        return False
    return True


def package_is_catalog_available(package: Package) -> bool:
    """A package is only offerable at all when it has items and every item is
    catalog-available — one discontinued/inactive item pulls the whole
    package, regardless of currency."""
    if not package.items:
        return False
    return all(item_is_catalog_available(item) for item in package.items)


def package_is_available_in_currency(package: Package, currency: Currency) -> bool:
    """A package is available in `currency` when it's catalog-available AND
    every item has a price in that currency AND (for final_price mode) a
    pricing_value is set for that currency."""
    if not package_is_catalog_available(package):
        return False
    if not package_has_all_items_priced(package, currency):
        return False
    if package.pricing_mode == PackagePricingMode.final_price:
        value = package.pricing_value_ars if currency == Currency.ARS else package.pricing_value_usd
        if value is None:
            return False
    return True
