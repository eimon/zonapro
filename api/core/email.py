from pathlib import Path

import resend
from jinja2 import Environment, FileSystemLoader

from core.config import settings
from core.branding import ACCENT_COLOR, COMPANY_EMAIL, COMPANY_NAME, COMPANY_TAGLINE

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

ROLE_LABELS = {"admin": "Administrador", "vendedor": "Vendedor", "cliente": "Cliente"}


def _render(template_name: str, **context) -> str:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    return env.get_template(template_name).render(
        company_name=COMPANY_NAME,
        company_tagline=COMPANY_TAGLINE,
        company_email=COMPANY_EMAIL,
        accent_color=ACCENT_COLOR,
        **context,
    )


def _send(to_email: str, subject: str, html_content: str, api_key: str | None) -> None:
    # The key can be configured at runtime (Configuración → Resend), so it's resolved
    # per-send rather than once at import time; falls back to the env var if unset.
    resend.api_key = api_key or settings.RESEND_API_KEY
    resend.Emails.send(
        {
            "from": settings.EMAIL_FROM,
            "to": to_email,
            "subject": subject,
            "html": html_content,
        }
    )


def send_invite_email(
    to_email: str, nombre: str, role: str, set_password_url: str, api_key: str | None = None
) -> None:
    html_content = _render(
        "invite_email.html",
        nombre=nombre,
        role_label=ROLE_LABELS.get(role, role),
        set_password_url=set_password_url,
    )
    _send(to_email, f"Te invitamos a sumarte a {COMPANY_NAME}", html_content, api_key)


def send_password_reset_email(
    to_email: str, nombre: str, reset_url: str, api_key: str | None = None
) -> None:
    html_content = _render(
        "password_reset_email.html",
        nombre=nombre,
        reset_url=reset_url,
        expire_hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS,
    )
    _send(to_email, f"Restablecé tu contraseña de {COMPANY_NAME}", html_content, api_key)
