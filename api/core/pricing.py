from decimal import Decimal
from models.quote import Quote
from models.enums import QuoteItemKind, InstallationCostType


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


def quote_total(quote: Quote) -> Decimal:
    return items_subtotal(quote) + installation_cost_amount(quote)
