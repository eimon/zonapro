import io
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.pdf import generate_quote_jpg, generate_quote_pdf
from core.roles import Permission
from dependencies.auth import has_role
from models.enums import QuoteType
from models.user import User
from schemas.quote import (
    QuoteCreate,
    QuoteInternalResponse,
    QuoteItemCreate,
    QuoteItemUpdate,
    QuoteUpdate,
)
from services.quote_service import QuoteService

router = APIRouter(prefix=f"{settings.API_V1_STR}/quotes", tags=["quotes"])


def _build_response(quote) -> dict:
    """Convert SQLAlchemy Quote to a dict compatible with QuoteInternalResponse."""
    return quote


@router.get("/", response_model=list[QuoteInternalResponse])
async def list_quotes(
    quote_type: QuoteType = QuoteType.productos,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_VIEW_OWN)),
):
    return await QuoteService(db).list_for_user(current_user, quote_type)


@router.post("/", response_model=QuoteInternalResponse, status_code=201)
async def create_quote(
    data: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_CREATE)),
):
    return await QuoteService(db).create(data, created_by_id=current_user.id)


@router.get("/{quote_id}", response_model=QuoteInternalResponse)
async def get_quote(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_VIEW_OWN)),
):
    return await QuoteService(db).get_by_id(quote_id, current_user)


@router.patch("/{quote_id}", response_model=QuoteInternalResponse)
async def update_quote(
    quote_id: uuid.UUID,
    data: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_CREATE)),
):
    return await QuoteService(db).update(quote_id, data, current_user)


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_CREATE)),
):
    await QuoteService(db).delete(quote_id, current_user)


@router.post("/{quote_id}/items", response_model=QuoteInternalResponse, status_code=201)
async def add_item(
    quote_id: uuid.UUID,
    data: QuoteItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_CREATE)),
):
    return await QuoteService(db).add_item(quote_id, data, current_user)


@router.patch("/{quote_id}/items/{item_id}", response_model=QuoteInternalResponse)
async def update_item(
    quote_id: uuid.UUID,
    item_id: uuid.UUID,
    data: QuoteItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_CREATE)),
):
    return await QuoteService(db).update_item(quote_id, item_id, data, current_user)


@router.delete("/{quote_id}/items/{item_id}", status_code=204)
async def remove_item(
    quote_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_CREATE)),
):
    await QuoteService(db).remove_item(quote_id, item_id, current_user)


@router.get("/{quote_id}/export/pdf")
async def export_pdf(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_VIEW_OWN)),
):
    quote = await QuoteService(db).get_by_id(quote_id, current_user)
    pdf_bytes = generate_quote_pdf(quote)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="cotizacion-{quote.id}.pdf"'
        },
    )


@router.get("/{quote_id}/export/jpg")
async def export_jpg(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(has_role(Permission.QUOTE_VIEW_OWN)),
):
    quote = await QuoteService(db).get_by_id(quote_id, current_user)
    jpg_bytes = generate_quote_jpg(quote)
    return StreamingResponse(
        io.BytesIO(jpg_bytes),
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f'attachment; filename="cotizacion-{quote.id}.jpg"'
        },
    )
