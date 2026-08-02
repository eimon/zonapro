from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from core.branding import (
    ACCENT_COLOR,
    COMPANY_ADDRESS,
    COMPANY_EMAIL,
    COMPANY_NAME,
    COMPANY_PHONE,
    COMPANY_TAGLINE,
    LOGO_BASE64,
)
from core.pricing import installation_cost_amount, items_subtotal, quote_total
from models.enums import InstallationCostType
from models.quote import Quote

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def format_ars(value) -> str:
    """Format like the web (es-AR): '.' for thousands, ',' for decimals."""
    number = Decimal(value)
    formatted = f"{number:,.2f}"
    return formatted.translate(str.maketrans(",.", ".,"))


def generate_quote_pdf(quote: Quote) -> bytes:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    env.filters["ars"] = format_ars
    template = env.get_template("quote_pdf.html")

    subtotal = items_subtotal(quote)
    installation_amount = installation_cost_amount(quote)
    total = quote_total(quote)
    validity_date = quote.created_at + timedelta(days=quote.validity_days)

    html_content = template.render(
        quote=quote,
        items=quote.items,
        subtotal=subtotal,
        installation_amount=installation_amount,
        installation_is_percentage=quote.installation_cost_type == InstallationCostType.percentage,
        total=total,
        validity_date=validity_date,
        company_name=COMPANY_NAME,
        company_tagline=COMPANY_TAGLINE,
        company_email=COMPANY_EMAIL,
        company_phone=COMPANY_PHONE,
        company_address=COMPANY_ADDRESS,
        accent_color=ACCENT_COLOR,
        logo_base64=LOGO_BASE64,
    )

    return HTML(string=html_content).write_pdf()
