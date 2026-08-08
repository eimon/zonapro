from decimal import Decimal
from models.quote import Quote, QuoteItem
from models.enums import QuoteItemKind, InstallationCostType

INSTALLATION_IVA_RATE = Decimal("21")


def products_subtotal(quote: Quote) -> Decimal:
    return sum(
        (item.subtotal for item in quote.items if item.kind == QuoteItemKind.product),
        Decimal("0"),
    )


def items_subtotal(quote: Quote) -> Decimal:
    return sum((item.subtotal for item in quote.items), Decimal("0"))


def installation_cost_amount(quote: Quote) -> Decimal:
    if not quote.installation_cost_type or quote.installation_cost_value is None:
        return Decimal("0")
    if quote.installation_cost_type == InstallationCostType.fixed:
        return quote.installation_cost_value
    return (products_subtotal(quote) * quote.installation_cost_value / Decimal("100")).quantize(
        Decimal("0.01")
    )


def item_iva_amount(item: QuoteItem) -> Decimal:
    rate = item.iva_rate if item.iva_rate is not None else Decimal("0")
    return (item.subtotal * Decimal(rate) / Decimal("100")).quantize(Decimal("0.01"))


def items_iva_total(quote: Quote) -> Decimal:
    return sum((item_iva_amount(item) for item in quote.items), Decimal("0"))


def installation_cost_iva_amount(quote: Quote) -> Decimal:
    if not quote.contempla_iva:
        return Decimal("0")
    return (installation_cost_amount(quote) * INSTALLATION_IVA_RATE / Decimal("100")).quantize(
        Decimal("0.01")
    )


def quote_total(quote: Quote) -> Decimal:
    net = items_subtotal(quote) + installation_cost_amount(quote)
    if not quote.contempla_iva:
        return net
    return net + items_iva_total(quote) + installation_cost_iva_amount(quote)
