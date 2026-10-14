import uuid
from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from models.enums import QuoteStatus, QuoteType, Currency


class QuotesByStatus(BaseModel):
    status: QuoteStatus
    # Total across all quote types.
    count: int
    productos: int = 0
    servicios: int = 0
    construccion: int = 0


class QuotesPerDay(BaseModel):
    date: date
    productos: int
    servicios: int
    construccion: int = 0


class ApprovedQuotesSummary(BaseModel):
    count: int
    # One total per currency, never summed across currencies.
    value: dict[Currency, Decimal]


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
    # Never summed across currencies — one total per currency, keyed by
    # Currency ("ARS"/"USD"); a currency with no approved quotes maps to 0.
    approved_quotes_value: dict[Currency, Decimal]
    # Same totals split by quote type; every type is always present.
    approved_quotes_by_type: dict[QuoteType, ApprovedQuotesSummary]
    pending_consultations: int
    quotes_by_status: list[QuotesByStatus]
    quotes_last_30_days: list[QuotesPerDay]
    low_stock_variants: list[LowStockVariant]
