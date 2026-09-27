import uuid
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel

CatalogAvailability = Literal["in_stock", "made_to_order", "out_of_stock"]
CatalogSort = Literal["featured", "price_asc", "price_desc"]


class CatalogCategoryRef(BaseModel):
    slug: str
    name: str

    # Also used as the nested `category` field on ProductResponse (see
    # schemas/product.py) — that path builds it from the ORM `Category`
    # relationship object, not a dict, so it needs from_attributes too.
    model_config = {"from_attributes": True}


class CatalogProductItem(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    image_url: str | None
    category: CatalogCategoryRef | None
    # MIN over active variants of final price (net * (1 + iva_rate/100)).
    from_price: Decimal
    # The NET price of that same min-price variant — shown as the muted
    # "Precio sin impuestos" detail below from_price.
    from_price_net: Decimal
    # True when active variants have more than one distinct final price —
    # drives the "Desde" vs "Precio final" label on the web.
    has_multiple_prices: bool
    variant_count: int
    variants_label: str
    availability: CatalogAvailability

    model_config = {"from_attributes": True}


class CatalogFacetOption(BaseModel):
    id: str
    label: str
    count: int


class CatalogCategoryFacet(BaseModel):
    slug: str
    name: str
    count: int


class CatalogFacets(BaseModel):
    categories: list[CatalogCategoryFacet]
    availability: list[CatalogFacetOption]
    price: list[CatalogFacetOption]


class CatalogResponse(BaseModel):
    items: list[CatalogProductItem]
    total: int
    page: int
    page_size: int
    facets: CatalogFacets
