import io
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from exceptions.general import BadRequestException

PRODUCTS_DIR = Path(__file__).parent.parent / "uploads" / "products"

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB
MAX_DIMENSION = 1600


async def save_product_image(file: UploadFile) -> str:
    # Created lazily (not at import time) so a missing/misconfigured uploads/
    # dir only breaks this endpoint, not every route in the app.
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)

    if not (file.content_type or "").startswith("image/"):
        raise BadRequestException("El archivo debe ser una imagen")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise BadRequestException("La imagen no puede superar los 8MB")

    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except UnidentifiedImageError:
        raise BadRequestException("No se pudo leer la imagen")

    has_alpha = image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info
    image = image.convert("RGBA" if has_alpha else "RGB")
    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

    filename = f"{uuid.uuid4().hex}.webp"
    image.save(PRODUCTS_DIR / filename, "WEBP", quality=85)

    # Relative on purpose: the web app proxies /uploads/* to this API (see
    # next.config.ts rewrites), so this works unmodified in any environment
    # and next/image never has to fetch a cross-host/private-IP URL server-side.
    return f"/uploads/products/{filename}"
