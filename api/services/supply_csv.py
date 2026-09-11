"""Pure CSV contract for supply (insumo) import/export.

Mirrors `product_csv.py`'s shape exactly, minus the fields that don't apply
to supplies (no slug — `name` plays that role per design D1 — no
category_slug/image_url/made_to_order). Shares primitives with
`product_csv.py` via `csv_common.py` so the es-AR decimal rules and the
CSV-formula-injection guard can't drift between the two catalogs.
"""
import json

from services.csv_common import (
    RowError,
    decode_and_read as _decode_and_read,
    parse_attributes,
    parse_bool,
    parse_decimal,
    parse_iva_rate,
    write_csv as _write_csv,
)

COLUMNS = (
    "supply_id",
    "name",
    "description",
    "iva_rate",
    "is_active",
    "variant_id",
    "sku",
    "variant_name",
    "attributes",
    "price",
    "price_input_mode",
    "stock_qty",
    "final_price",
)

SUPPLY_COLUMNS = {
    "name",
    "description",
    "iva_rate",
    "is_active",
}
VARIANT_COLUMNS = {
    "sku",
    "variant_name",
    "attributes",
    "price",
    "price_input_mode",
    "stock_qty",
}
REQUIRED_NON_EMPTY = {"name", "sku", "variant_name", "price"}
CREATE_ONLY_REQUIRED = {"iva_rate"}

# Columns that clear the field to NULL when the cell is present but empty.
_NULLABLE_COLUMNS = {"description"}
# NOT-NULL-with-default columns: an empty cell leaves the field untouched.
_SKIP_ON_EMPTY_COLUMNS = {"is_active", "stock_qty", "iva_rate"}

_SUPPLY_FIELD_NAME = {
    "name": "name",
    "description": "description",
    "iva_rate": "iva_rate",
    "is_active": "is_active",
}
_VARIANT_FIELD_NAME = {
    "sku": "sku",
    "variant_name": "name",
    "attributes": "attributes",
    "price": "price",
    "price_input_mode": "price_input_mode",
    "stock_qty": "stock_qty",
}


def decode_and_read(raw: bytes) -> tuple:
    return _decode_and_read(raw, COLUMNS)


def map_row(row: dict, present: set[str]) -> tuple[dict, dict]:
    """Map one CSV row into (supply_fields, variant_fields) using the
    file-level partial-column contract: a column absent from `present` is
    never touched; a required column with an empty cell raises; a nullable
    column with an empty cell clears to None; a NOT-NULL-with-default
    column with an empty cell is simply omitted (left unchanged)."""
    supply_fields: dict = {}
    variant_fields: dict = {}

    for col in present:
        if col not in SUPPLY_COLUMNS and col not in VARIANT_COLUMNS:
            continue  # resolution-only columns (supply_id, variant_id) — read directly by the caller

        raw = (row.get(col) or "").strip()
        is_supply = col in SUPPLY_COLUMNS
        target = supply_fields if is_supply else variant_fields
        field_name = _SUPPLY_FIELD_NAME[col] if is_supply else _VARIANT_FIELD_NAME[col]

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
        elif col == "is_active":
            target[field_name] = parse_bool(raw)
        elif col == "stock_qty":
            try:
                target[field_name] = int(raw)
            except ValueError:
                raise RowError(f"stock_qty inválido: '{raw}'")
        elif col == "price":
            target[field_name] = parse_decimal(raw)
        else:
            target[field_name] = raw

    return supply_fields, variant_fields


def serialize_row(supply, variant, final_price) -> list[str]:
    """Serialize one (supply, variant) pair into an export row, in COLUMNS order."""
    attrs = variant.attributes or {}
    return [
        str(supply.id),
        supply.name,
        supply.description or "",
        supply.iva_rate.value,
        "true" if supply.is_active else "false",
        str(variant.id),
        variant.sku,
        variant.name,
        json.dumps(attrs, ensure_ascii=False, sort_keys=True),
        str(variant.price),
        "",  # price_input_mode is import-only
        str(variant.stock_qty),
        str(final_price),
    ]


def write_csv(rows: list[list[str]], delimiter: str = ",") -> str:
    return _write_csv(rows, COLUMNS, delimiter=delimiter)
