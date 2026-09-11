import base64
from dataclasses import dataclass
from pathlib import Path

from models.enums import QuoteType

# These flat constants stay exactly as they are — core/email.py imports them
# directly for transactional emails and must keep the default brand.
COMPANY_NAME = "ZonaPro"
COMPANY_TAGLINE = "Domótica · Climatización · Energía Solar"
COMPANY_EMAIL = "info@zona-pro.com.ar"
COMPANY_PHONES = ["+54 9 3492 20-8383", "+54 9 2944 22-6962"]
COMPANY_ADDRESS = "Villa La Angostura, Argentina"
ACCENT_COLOR = "#326fc8"  # brand blue

ASSETS_DIR = Path(__file__).parent.parent / "assets"

LOGO_PATH = ASSETS_DIR / "logo.png"
LOGO_BASE64 = base64.b64encode(LOGO_PATH.read_bytes()).decode("ascii") if LOGO_PATH.exists() else ""


def _load_logo(filename: str) -> str:
    path = ASSETS_DIR / filename
    return base64.b64encode(path.read_bytes()).decode("ascii") if path.exists() else ""


@dataclass(frozen=True)
class BrandingBundle:
    company_name: str
    email: str
    phones: list[str]
    address: str
    accent_color: str
    logo_base64: str
    # "" (never None) — Jinja renders None as the literal string "None"; an
    # empty string is falsy and the template additionally guards with
    # {% if %} so an absent tagline/CUIT renders no line at all.
    tagline: str = ""
    cuit: str = ""


BRANDING_PRODUCTOS = BrandingBundle(
    company_name=COMPANY_NAME,
    tagline=COMPANY_TAGLINE,
    email=COMPANY_EMAIL,
    phones=COMPANY_PHONES,
    address=COMPANY_ADDRESS,
    accent_color=ACCENT_COLOR,
    logo_base64=LOGO_BASE64,
)

BRANDING_SERVICIOS = BrandingBundle(
    company_name="HS Soluciones Integrales",
    tagline="",
    email="hs@zona-pro.com.ar",
    phones=COMPANY_PHONES,  # same phones as the default brand
    address="Villa La Angostura, Neuquén",
    accent_color="#081d36",
    logo_base64=_load_logo("logo_hs.png") or LOGO_BASE64,  # degrade, never a blank header
    cuit="20-33215143-7",
)

BRANDING_BY_QUOTE_TYPE = {
    QuoteType.productos: BRANDING_PRODUCTOS,
    QuoteType.servicios: BRANDING_SERVICIOS,
}


def resolve_branding(quote_type) -> BrandingBundle:
    return BRANDING_BY_QUOTE_TYPE.get(quote_type, BRANDING_PRODUCTOS)
