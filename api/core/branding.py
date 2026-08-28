import base64
from pathlib import Path

COMPANY_NAME = "ZonaPro"
COMPANY_TAGLINE = "Domótica · Climatización · Energía Solar"
COMPANY_EMAIL = "info@zona-pro.com.ar"
COMPANY_PHONES = ["+54 9 3492 20-8383", "+54 9 2944 22-6962"]
COMPANY_ADDRESS = "Villa La Angostura, Argentina"
ACCENT_COLOR = "#326fc8"  # brand blue

LOGO_PATH = Path(__file__).parent.parent / "assets" / "logo.png"
LOGO_BASE64 = base64.b64encode(LOGO_PATH.read_bytes()).decode("ascii") if LOGO_PATH.exists() else ""
