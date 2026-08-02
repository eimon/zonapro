from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from core.config import settings
import models  # noqa: F401
from routers import users, auth, category, product, package, consultation, quote
from routers import settings as settings_router
from exceptions.handlers import register_exception_handlers
import logging

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(category.router)
app.include_router(product.router)
app.include_router(package.router)
app.include_router(consultation.router)
app.include_router(quote.router)
app.include_router(settings_router.router)

UPLOADS_DIR = Path(__file__).parent / "uploads"
try:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "products").mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
except PermissionError:
    logging.warning(
        "Could not create/mount %s (permission denied on the bind-mounted volume). "
        "Run: mkdir -p api/uploads/products && chmod 777 api/uploads api/uploads/products",
        UPLOADS_DIR,
    )


@app.get("/health")
async def health_check():
    return {"status": "ok"}
