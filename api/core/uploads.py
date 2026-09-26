import io
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from exceptions.general import BadRequestException

UPLOADS_ROOT = Path(__file__).parent.parent / "uploads"
PRODUCTS_DIR = UPLOADS_ROOT / "products"
SUPPLIES_DIR = UPLOADS_ROOT / "supplies"

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB
MAX_DIMENSION = 1600


async def _save_image(file: UploadFile, directory: Path, subdir: str) -> str:
    """Shared pipeline: validate → decode → normalize → webp-encode → save.
    `subdir` is the public /uploads/<subdir>/ segment (kept as a separate
    param from `directory` so callers can't drift the two apart)."""
    # Created lazily (not at import time) so a missing/misconfigured uploads/
    # dir only breaks this endpoint, not every route in the app.
    directory.mkdir(parents=True, exist_ok=True)

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
    image.save(directory / filename, "WEBP", quality=85)

    # Relative on purpose: the web app proxies /uploads/* to this API (see
    # next.config.ts rewrites), so this works unmodified in any environment
    # and next/image never has to fetch a cross-host/private-IP URL server-side.
    return f"/uploads/{subdir}/{filename}"


async def save_product_image(file: UploadFile) -> str:
    return await _save_image(file, PRODUCTS_DIR, "products")


async def save_supply_image(file: UploadFile) -> str:
    return await _save_image(file, SUPPLIES_DIR, "supplies")
