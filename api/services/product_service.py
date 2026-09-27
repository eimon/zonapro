import uuid
from dataclasses import dataclass
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.product_repository import ProductRepository, ProductVariantRepository
from schemas.product import ProductCreate, ProductUpdate, ProductVariantCreate, ProductVariantUpdate
from schemas.catalog import (
    CatalogResponse,
    CatalogProductItem,
    CatalogCategoryRef,
    CatalogCategoryFacet,
    CatalogFacetOption,
    CatalogFacets,
)
from models.product import Product, ProductVariant
from models.enums import IvaRate
from exceptions.general import NotFoundException, ConflictException, BadRequestException


def _to_net_price(price: Decimal, mode: str, iva_rate: IvaRate) -> Decimal:
    if mode == "net":
        return price
    rate = Decimal(iva_rate.value)
    return (price / (1 + rate / Decimal("100"))).quantize(Decimal("0.01"))


def _compute_final_price(price: Decimal, iva_rate: IvaRate) -> Decimal:
    rate = Decimal(iva_rate.value)
    return (price * (1 + rate / Decimal("100"))).quantize(Decimal("0.01"))


def _attach_variant_final_prices(product: Product) -> Product:
    for variant in product.variants:
        variant.final_price = _compute_final_price(variant.price, product.iva_rate)
    return product


# ── Public catalog (faceted search) ─────────────────────────────────────────

# Fixed price buckets, evaluated on a product's from_price (its cheapest
# active variant's final price). Labels match the storefront design exactly.
_PRICE_BUCKETS: list[tuple[str, str]] = [
    ("lte_300k", "Hasta $ 300.000"),
    ("300k_1500k", "$ 300.000 a $ 1.500.000"),
    ("gt_1500k", "Más de $ 1.500.000"),
]
_PRICE_BUCKET_THRESHOLDS = (Decimal("300000"), Decimal("1500000"))


def _price_bucket_id(price: Decimal) -> str:
    low, high = _PRICE_BUCKET_THRESHOLDS
    if price <= low:
        return "lte_300k"
    if price <= high:
        return "300k_1500k"
    return "gt_1500k"


_AVAILABILITY_LABELS: dict[str, str] = {
    "in_stock": "En stock",
    "made_to_order": "A pedido",
    "out_of_stock": "Sin stock",
}
# Ordering used for both the facet list and the "featured" sort tie-break.
_AVAILABILITY_ORDER = ["in_stock", "made_to_order", "out_of_stock"]


@dataclass
class _CatalogRow:
    """Internal, pre-computed representation of one catalog-eligible product
    — built once per request from the raw Product+variants, then reused for
    both filtering/faceting and the final response items."""

    product: Product
    from_price: Decimal
    from_price_net: Decimal
    has_multiple_prices: bool
    variant_count: int
    availability: str
    category_slug: str | None
    category_name: str | None
    price_bucket: str


def _build_catalog_row(product: Product) -> "_CatalogRow | None":
    active_variants = [v for v in product.variants if v.deleted_at is None]
    if not active_variants:
        return None  # products need >=1 active, non-deleted variant

    final_prices = [_compute_final_price(v.price, product.iva_rate) for v in active_variants]
    cheapest_variant = min(active_variants, key=lambda v: _compute_final_price(v.price, product.iva_rate))
    from_price = min(final_prices)
    from_price_net = cheapest_variant.price
    has_multiple_prices = len(set(final_prices)) > 1

    if product.made_to_order:
        availability = "made_to_order"
    elif sum(v.stock_qty for v in active_variants) > 0:
        availability = "in_stock"
    else:
        availability = "out_of_stock"

    category_slug = product.category.slug if product.category else None
    category_name = product.category.name if product.category else None

    return _CatalogRow(
        product=product,
        from_price=from_price,
        from_price_net=from_price_net,
        has_multiple_prices=has_multiple_prices,
        variant_count=len(active_variants),
        availability=availability,
        category_slug=category_slug,
        category_name=category_name,
        price_bucket=_price_bucket_id(from_price),
    )


def _variants_label(variant_count: int) -> str:
    return "Variante única" if variant_count == 1 else f"{variant_count} variantes"


class ProductService:
    def __init__(self, db: AsyncSession):
        self.repo = ProductRepository(db)
        self.variant_repo = ProductVariantRepository(db)

    async def _assert_sku_free(self, sku: str, exclude_id: uuid.UUID | None = None) -> None:
        clash = await self.variant_repo.get_by_sku(sku, exclude_id=exclude_id)
        if clash:
            raise ConflictException(
                f"El SKU '{sku}' ya pertenece al producto '{clash.product.slug}'"
            )

    async def get_all(
        self,
        category_id: uuid.UUID | None = None,
        made_to_order: bool | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Product]:
        products = await self.repo.get_all_with_variants(
            category_id=category_id,
            made_to_order=made_to_order,
            skip=skip,
            limit=limit,
        )
        return [_attach_variant_final_prices(p) for p in products]

    async def get_catalog(
        self,
        q: str | None,
        categories: list[str],
        availabilities: list[str],
        prices: list[str],
        sort: str,
        page: int,
        page_size: int,
    ) -> CatalogResponse:
        raw_products = await self.repo.get_catalog_products()
        rows = [row for p in raw_products if (row := _build_catalog_row(p)) is not None]

        q_norm = (q or "").strip().lower()
        categories_set = set(categories)
        availabilities_set = set(availabilities)
        prices_set = set(prices)

        def matches(row: _CatalogRow, skip: str | None) -> bool:
            if q_norm and q_norm not in row.product.name.lower():
                return False
            if skip != "category" and categories_set and row.category_slug not in categories_set:
                return False
            if skip != "availability" and availabilities_set and row.availability not in availabilities_set:
                return False
            if skip != "price" and prices_set and row.price_bucket not in prices_set:
                return False
            return True

        # Disjunctive faceting: OR within a facet, AND across facets. Each
        # facet's own counts ignore its own selection (skip=<facet>) so
        # options never "vanish" once picked — mirrors the approved design's
        # renderVals() logic exactly.

        # Category/availability options are only OFFERED when they have >=1
        # product somewhere in the whole active catalog (no filters at all,
        # not even q) — a category with zero products across the whole
        # catalog is omitted entirely, not just disabled.
        whole_catalog_categories: dict[str, str] = {}
        whole_catalog_availability: set[str] = set()
        for row in rows:
            if row.category_slug:
                whole_catalog_categories[row.category_slug] = row.category_name or row.category_slug
            whole_catalog_availability.add(row.availability)

        category_facet = [
            CatalogCategoryFacet(
                slug=slug,
                name=name,
                count=sum(1 for r in rows if matches(r, "category") and r.category_slug == slug),
            )
            for slug, name in sorted(whole_catalog_categories.items(), key=lambda kv: kv[1])
        ]

        availability_facet = [
            CatalogFacetOption(
                id=av_id,
                label=_AVAILABILITY_LABELS[av_id],
                count=sum(1 for r in rows if matches(r, "availability") and r.availability == av_id),
            )
            for av_id in _AVAILABILITY_ORDER
            if av_id in whole_catalog_availability
        ]

        # Price buckets are fixed (not data-driven), so unlike category/
        # availability they're never omitted — a zero-count bucket is still
        # returned and the web disables it unless already selected.
        price_facet = [
            CatalogFacetOption(
                id=bucket_id,
                label=label,
                count=sum(1 for r in rows if matches(r, "price") and r.price_bucket == bucket_id),
            )
            for bucket_id, label in _PRICE_BUCKETS
        ]

        results = [r for r in rows if matches(r, None)]

        if sort == "price_asc":
            results.sort(key=lambda r: r.from_price)
        elif sort == "price_desc":
            results.sort(key=lambda r: r.from_price, reverse=True)
        else:
            # "featured" (default): in-stock first, then made-to-order, then
            # out-of-stock; newest first within each group.
            availability_rank = {av: i for i, av in enumerate(_AVAILABILITY_ORDER)}
            results.sort(
                key=lambda r: (
                    availability_rank[r.availability],
                    -r.product.created_at.timestamp(),
                )
            )

        total = len(results)
        start = (page - 1) * page_size
        page_rows = results[start : start + page_size]

        items = [
            CatalogProductItem(
                id=r.product.id,
                name=r.product.name,
                slug=r.product.slug,
                image_url=r.product.image_url,
                category=(
                    CatalogCategoryRef(slug=r.category_slug, name=r.category_name)
                    if r.category_slug and r.category_name
                    else None
                ),
                from_price=r.from_price,
                from_price_net=r.from_price_net,
                has_multiple_prices=r.has_multiple_prices,
                variant_count=r.variant_count,
                variants_label=_variants_label(r.variant_count),
                availability=r.availability,
            )
            for r in page_rows
        ]

        return CatalogResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            facets=CatalogFacets(
                categories=category_facet,
                availability=availability_facet,
                price=price_facet,
            ),
        )

    async def get_by_id(self, id: uuid.UUID) -> Product:
        obj = await self.repo.get_with_variants(id)
        if not obj:
            raise NotFoundException("Producto no encontrado")
        return _attach_variant_final_prices(obj)

    async def create(self, data: ProductCreate) -> Product:
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictException("Ya existe un producto con ese slug")

        seen_skus: set[str] = set()
        for variant_data in data.variants:
            if variant_data.sku in seen_skus:
                raise ConflictException(f"El SKU '{variant_data.sku}' está repetido en el mismo producto")
            seen_skus.add(variant_data.sku)
            await self._assert_sku_free(variant_data.sku)

        product = await self.repo.create(data)

        for variant_data in data.variants:
            variant_price = _to_net_price(variant_data.price, variant_data.price_input_mode, data.iva_rate)
            await self.variant_repo.create(product.id, variant_data, price=variant_price)

        # reload with variants
        reloaded = await self.repo.get_with_variants(product.id)
        return _attach_variant_final_prices(reloaded)

    async def update(self, id: uuid.UUID, data: ProductUpdate) -> Product:
        obj = await self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)
        if "slug" in update_data and update_data["slug"] != obj.slug:
            existing = await self.repo.get_by_slug(update_data["slug"])
            if existing:
                raise ConflictException("Ya existe un producto con ese slug")

        await self.repo.update(obj, **update_data)
        reloaded = await self.repo.get_with_variants(obj.id)
        return _attach_variant_final_prices(reloaded)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self.get_by_id(id)
        await self.variant_repo.soft_delete_all_for_product(obj.id)
        result = await self.repo.soft_delete(obj.id)
        if not result:
            raise NotFoundException("Producto no encontrado")

    async def create_variant(self, product_id: uuid.UUID, data: ProductVariantCreate) -> ProductVariant:
        product = await self.get_by_id(product_id)  # ensures product exists
        await self._assert_sku_free(data.sku)
        price = _to_net_price(data.price, data.price_input_mode, product.iva_rate)
        variant = await self.variant_repo.create(product_id, data, price=price)
        variant.final_price = _compute_final_price(variant.price, product.iva_rate)
        return variant

    async def update_variant(self, variant_id: uuid.UUID, data: ProductVariantUpdate) -> ProductVariant:
        obj = await self.variant_repo.get_by_id(variant_id)
        if not obj or obj.deleted_at is not None:
            raise NotFoundException("Variante no encontrada")
        update_data = data.model_dump(exclude_unset=True)
        if "stock_qty" in update_data and update_data["stock_qty"] < 0:
            raise BadRequestException("El stock no puede ser negativo")
        if "sku" in update_data and update_data["sku"] != obj.sku:
            await self._assert_sku_free(update_data["sku"], exclude_id=obj.id)

        product = await self.repo.get_by_id(obj.product_id)
        price_input_mode = update_data.pop("price_input_mode", "net")
        if "price" in update_data and update_data["price"] is not None:
            update_data["price"] = _to_net_price(update_data["price"], price_input_mode, product.iva_rate)

        variant = await self.variant_repo.update(obj, **update_data)
        variant.final_price = _compute_final_price(variant.price, product.iva_rate)
        return variant

    async def delete_variant(self, variant_id: uuid.UUID) -> None:
        variant = await self.variant_repo.get_by_id(variant_id)
        if not variant or variant.deleted_at is not None:
            raise NotFoundException("Variante no encontrada")

        active_count = await self.variant_repo.count_active_for_product(variant.product_id)
        if active_count <= 1:
            raise BadRequestException("No podés eliminar la única variante del producto")

        result = await self.variant_repo.hard_delete(variant_id)
        if not result:
            raise NotFoundException("Variante no encontrada")
