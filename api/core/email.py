from pathlib import Path

import resend
from jinja2 import Environment, FileSystemLoader

from core.config import settings
from core.branding import ACCENT_COLOR, COMPANY_EMAIL, COMPANY_NAME, COMPANY_TAGLINE

resend.api_key = settings.RESEND_API_KEY

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

ROLE_LABELS = {"admin": "Administrador", "vendedor": "Vendedor", "cliente": "Cliente"}


def send_invite_email(to_email: str, nombre: str, role: str, set_password_url: str) -> None:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("invite_email.html")

    html_content = template.render(
        nombre=nombre,
        role_label=ROLE_LABELS.get(role, role),
        set_password_url=set_password_url,
        company_name=COMPANY_NAME,
        company_tagline=COMPANY_TAGLINE,
        company_email=COMPANY_EMAIL,
        accent_color=ACCENT_COLOR,
    )

    resend.Emails.send(
        {
            "from": settings.EMAIL_FROM,
            "to": to_email,
            "subject": f"Te invitamos a sumarte a {COMPANY_NAME}",
            "html": html_content,
        }
    )
