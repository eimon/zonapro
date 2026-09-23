import uuid
from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from models.enums import QuoteStatus


class QuotesByStatus(BaseModel):
    status: QuoteStatus
    count: int


class QuotesPerDay(BaseModel):
    date: date
    productos: int
    servicios: int
    construccion: int = 0


class LowStockVariant(BaseModel):
    variant_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    sku: str
    stock_qty: int


class DashboardStats(BaseModel):
    active_products: int
    active_supplies: int
    approved_quotes_count: int
    approved_quotes_value: Decimal
    pending_consultations: int
    quotes_by_status: list[QuotesByStatus]
    quotes_last_30_days: list[QuotesPerDay]
    low_stock_variants: list[LowStockVariant]
