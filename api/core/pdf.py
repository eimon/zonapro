import io
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import fitz
from jinja2 import Environment, FileSystemLoader
from PIL import Image
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
from core.pricing import (
    installation_cost_amount,
    item_iva_amount,
    items_subtotal,
    quote_total,
)
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

    for item in quote.items:
        if quote.contempla_iva:
            item.display_unit_price = (
                item.unit_price * (1 + item.iva_rate / Decimal("100"))
            ).quantize(Decimal("0.01"))
            item.display_iva_amount = item_iva_amount(item)
            item.display_subtotal = item.subtotal + item.display_iva_amount
        else:
            item.display_unit_price = item.unit_price
            item.display_subtotal = item.subtotal

    html_content = template.render(
        quote=quote,
        items=quote.items,
        subtotal=subtotal,
        installation_amount=installation_amount,
        installation_is_percentage=quote.installation_cost_type == InstallationCostType.percentage,
        total=total,
        contempla_iva=quote.contempla_iva,
        iva_amount=quote.iva_amount,
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


def generate_quote_jpg(quote: Quote, dpi: int = 150) -> bytes:
    """Render the quote PDF to a single JPEG (pages stacked vertically if it spans more than one)."""
    pdf_bytes = generate_quote_pdf(quote)

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    try:
        pages = [doc.load_page(i).get_pixmap(matrix=matrix) for i in range(doc.page_count)]
    finally:
        doc.close()

    images = [Image.frombytes("RGB", (pix.width, pix.height), pix.samples) for pix in pages]

    if len(images) == 1:
        combined = images[0]
    else:
        width = max(img.width for img in images)
        total_height = sum(img.height for img in images)
        combined = Image.new("RGB", (width, total_height), "white")
        y = 0
        for img in images:
            combined.paste(img, (0, y))
            y += img.height

    buffer = io.BytesIO()
    combined.save(buffer, format="JPEG", quality=92)
    return buffer.getvalue()
