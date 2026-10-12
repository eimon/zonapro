"""Pure CSV contract for product import/export.

No DB access here — this module owns column order, coercion rules, and
row <-> payload mapping/serialization. `ProductImportService` and
`ProductExportService` both read it, so the file format can only drift
in one place.

The generic parsing/writing primitives (RowError, parse_bool/decimal/
attributes/iva_rate, decode_and_read, _csv_safe, write_csv) live in
`csv_common.py` and are re-exported here unchanged so existing imports
(`from services.product_csv import RowError, decode_and_read, ...`) keep
working — this file only owns the product-specific column contract.

Pricing columns: `price_ars` and `price_usd` are the current contract — a
variant needs at least one. The legacy single `price` column is still
recognized on IMPORT ONLY, as an alias for `price_usd` (matching the D
decision that every historical price is a USD amount) — it's ignored
whenever `price_usd` is also present in the same file. Export never emits
`price` anymore.
"""
import json

from services.csv_common import (
    RowError,
    _csv_safe,
    decode_and_read as _decode_and_read,
    parse_attributes,
    parse_bool,
    parse_decimal,
    parse_iva_rate,
    write_csv as _write_csv,
)

COLUMNS = (
    "product_id",
    "slug",
    "name",
    "description",
    "category_slug",
    "iva_rate",
    "image_url",
    "made_to_order",
    "is_active",
    "variant_id",
    "sku",
    "variant_name",
    "attributes",
    "price_ars",
    "price_usd",
    "price",  # legacy alias for price_usd — import-only, see module docstring
    "price_input_mode",
    "stock_qty",
    "final_price_ars",
    "final_price_usd",
)

PRODUCT_COLUMNS = {
    "name",
    "slug",
    "description",
    "category_slug",
    "iva_rate",
    "image_url",
    "made_to_order",
    "is_active",
}
VARIANT_COLUMNS = {
    "sku",
    "variant_name",
    "attributes",
    "price_ars",
    "price_usd",
    "price",
    "price_input_mode",
    "stock_qty",
}
REQUIRED_NON_EMPTY = {"name", "slug", "sku", "variant_name"}
CREATE_ONLY_REQUIRED = {"iva_rate"}

# Columns that clear the field to NULL when the cell is present but empty.
_NULLABLE_COLUMNS = {"description", "image_url", "category_slug"}
# NOT-NULL-with-default (or optional) columns: an empty cell leaves the field
# untouched (create: simply omitted; update: unchanged).
_SKIP_ON_EMPTY_COLUMNS = {"made_to_order", "is_active", "stock_qty", "iva_rate", "price_ars", "price_usd", "price"}

_PRODUCT_FIELD_NAME = {
    "name": "name",
    "slug": "slug",
    "description": "description",
    "category_slug": "category_slug",
    "iva_rate": "iva_rate",
    "image_url": "image_url",
    "made_to_order": "made_to_order",
    "is_active": "is_active",
}
_VARIANT_FIELD_NAME = {
    "sku": "sku",
    "variant_name": "name",
    "attributes": "attributes",
    "price_ars": "price_ars",
    "price_usd": "price_usd",
    "price": "price_usd",  # legacy alias
    "price_input_mode": "price_input_mode",
    "stock_qty": "stock_qty",
}


def decode_and_read(raw: bytes) -> tuple:
    return _decode_and_read(raw, COLUMNS)


def map_row(row: dict, present: set[str]) -> tuple[dict, dict]:
    """Map one CSV row into (product_fields, variant_fields) using the
    file-level partial-column contract (D8): a column absent from `present`
    is never touched; a required column with an empty cell raises; a nullable
    column with an empty cell clears to None; a NOT-NULL-with-default
    column with an empty cell is simply omitted (left unchanged)."""
    product_fields: dict = {}
    variant_fields: dict = {}

    for col in present:
        if col not in PRODUCT_COLUMNS and col not in VARIANT_COLUMNS:
            continue  # resolution-only columns (product_id, variant_id) — read directly by the caller

        # Legacy 'price' alias — ignored whenever the current 'price_usd'
        # column is also present in this file.
        if col == "price" and "price_usd" in present:
            continue

        raw = (row.get(col) or "").strip()
        is_product = col in PRODUCT_COLUMNS
        target = product_fields if is_product else variant_fields
        field_name = _PRODUCT_FIELD_NAME[col] if is_product else _VARIANT_FIELD_NAME[col]

        if col in REQUIRED_NON_EMPTY and not raw:
            raise RowError(f"'{col}' es obligatorio y no puede estar vacío")

        if col == "attributes":
            target[field_name] = parse_attributes(raw)
            continue

        if col == "price_input_mode":
            token = raw.lower() or "net"
            if token not in ("net", "final"):
                raise RowError(f"price_input_mode inválido: '{raw}' (usá 'net' o 'final')")
            target[field_name] = token
            continue

        if not raw:
            if col in _NULLABLE_COLUMNS:
                target[field_name] = None
            elif col in _SKIP_ON_EMPTY_COLUMNS:
                pass  # unchanged
            continue

        if col == "iva_rate":
            target[field_name] = parse_iva_rate(raw)
        elif col in ("made_to_order", "is_active"):
            target[field_name] = parse_bool(raw)
        elif col == "stock_qty":
            try:
                target[field_name] = int(raw)
            except ValueError:
                raise RowError(f"stock_qty inválido: '{raw}'")
        elif col in ("price_ars", "price_usd", "price"):
            target[field_name] = parse_decimal(raw)
        else:
            target[field_name] = raw

    return product_fields, variant_fields


def serialize_row(product, variant, final_price_ars, final_price_usd) -> list[str]:
    """Serialize one (product, variant) pair into an export row, in COLUMNS order."""
    attrs = variant.attributes or {}
    category = getattr(product, "category", None)
    return [
        str(product.id),
        product.slug,
        product.name,
        product.description or "",
        category.slug if category else "",
        product.iva_rate.value,
        product.image_url or "",
        "true" if product.made_to_order else "false",
        "true" if product.is_active else "false",
        str(variant.id),
        variant.sku,
        variant.name,
        json.dumps(attrs, ensure_ascii=False, sort_keys=True),
        str(variant.price_ars) if variant.price_ars is not None else "",
        str(variant.price_usd) if variant.price_usd is not None else "",
        "",  # legacy 'price' column — export-blank, import-only alias
        "",  # price_input_mode is import-only
        str(variant.stock_qty),
        str(final_price_ars) if final_price_ars is not None else "",
        str(final_price_usd) if final_price_usd is not None else "",
    ]


def write_csv(rows: list[list[str]], delimiter: str = ",") -> str:
    return _write_csv(rows, COLUMNS, delimiter=delimiter)
