"""Pure CSV contract for product import/export.

No DB access here — this module owns column order, coercion rules, and
row <-> payload mapping/serialization. `ProductImportService` and
`ProductExportService` both read it, so the file format can only drift
in one place.
"""
import csv
import io
import json
import re
from decimal import Decimal, InvalidOperation

from models.enums import IvaRate

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
    "price",
    "price_input_mode",
    "stock_qty",
    "final_price",
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
    "price",
    "price_input_mode",
    "stock_qty",
}
REQUIRED_NON_EMPTY = {"name", "slug", "sku", "variant_name", "price"}
CREATE_ONLY_REQUIRED = {"iva_rate"}

# Columns that clear the field to NULL when the cell is present but empty.
_NULLABLE_COLUMNS = {"description", "image_url", "category_slug"}
# NOT-NULL-with-default columns: an empty cell leaves the field untouched.
_SKIP_ON_EMPTY_COLUMNS = {"made_to_order", "is_active", "stock_qty", "iva_rate"}

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
    "price": "price",
    "price_input_mode": "price_input_mode",
    "stock_qty": "stock_qty",
}

_TRUE_TOKENS = {"true", "1", "yes", "si", "sí", "verdadero"}
_FALSE_TOKENS = {"false", "0", "no", "falso"}

# es-AR thousands-separator pattern, e.g. "1.234" or "1.234.567" — rejected so
# it can't be silently misread as a decimal (1.234 != mil doscientos treinta y cuatro).
_THOUSANDS_RE = re.compile(r"^\d{1,3}(\.\d{3})+$")


class RowError(Exception):
    """A per-row/per-cell validation failure. Carries a human message only, never a stack.

    `row_number` is optional — callers inside a per-row parsing loop already
    know the row number and don't need it on the exception; callers deeper
    inside group-write logic (ProductImportService._write_group) attach it so
    the outer handler can report the exact offending row instead of falling
    back to the group's first row.
    """

    def __init__(self, message: str, row_number: int | None = None):
        super().__init__(message)
        self.row_number = row_number


def decode_and_read(raw: bytes) -> tuple[csv.DictReader, set[str]]:
    """Decode raw upload bytes (utf-8-sig, Excel BOM-safe; falls back to
    cp1252 for files re-saved by Windows Excel's plain "CSV" export, which
    strips the BOM and re-encodes to the system ANSI codepage), sniff the
    delimiter (`,` or `;`), normalize headers, and return the DictReader plus
    the set of known columns actually present in the header — that set *is*
    the partial-column contract for the whole file."""
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    first_line = text.splitlines()[0] if text else ""
    try:
        dialect = csv.Sniffer().sniff(first_line, delimiters=",;")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ";" if first_line.count(";") > first_line.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    reader.fieldnames = [(fn or "").strip().lower() for fn in (reader.fieldnames or [])]
    present = set(reader.fieldnames or []) & set(COLUMNS)
    return reader, present


def parse_bool(raw: str) -> bool:
    token = raw.strip().lower()
    if token in _TRUE_TOKENS:
        return True
    if token in _FALSE_TOKENS:
        return False
    raise RowError(f"valor booleano inválido: '{raw}' (usá true/false, si/no, 1/0)")


def parse_decimal(raw: str) -> Decimal:
    token = raw.strip()
    if "," in token:
        raise RowError("usá punto decimal, sin separador de miles")
    if _THOUSANDS_RE.match(token):
        raise RowError(f"'{raw}' parece tener separador de miles estilo es-AR — usá punto decimal simple")
    try:
        return Decimal(token)
    except InvalidOperation:
        raise RowError(f"número inválido: '{raw}'")


def parse_attributes(raw: str) -> dict:
    token = raw.strip()
    if not token:
        return {}
    try:
        value = json.loads(token)
    except json.JSONDecodeError:
        raise RowError(f"JSON inválido en 'attributes': {raw}")
    if not isinstance(value, dict):
        raise RowError("'attributes' debe ser un objeto JSON")
    return value


def parse_iva_rate(raw: str) -> IvaRate:
    token = raw.strip().replace(",", ".")
    if "." in token:
        token = token.rstrip("0").rstrip(".")
    for rate in IvaRate:
        if rate.value == token:
            return rate
    legal = ", ".join(r.value for r in IvaRate)
    raise RowError(f"iva_rate inválido: '{raw}' (valores válidos: {legal})")


def map_row(row: dict, present: set[str]) -> tuple[dict, dict]:
    """Map one CSV row into (product_fields, variant_fields) using the
    file-level partial-column contract (D8): a column absent from `present`
    is never touched; a required column with an empty cell raises; a
    nullable column with an empty cell clears to None; a NOT-NULL-with-default
    column with an empty cell is simply omitted (left unchanged)."""
    product_fields: dict = {}
    variant_fields: dict = {}

    for col in present:
        if col not in PRODUCT_COLUMNS and col not in VARIANT_COLUMNS:
            continue  # resolution-only columns (product_id, variant_id) — read directly by the caller

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
        elif col == "price":
            target[field_name] = parse_decimal(raw)
        else:
            target[field_name] = raw

    return product_fields, variant_fields


def serialize_row(product, variant, final_price: Decimal) -> list[str]:
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
        str(variant.price),
        "",  # price_input_mode is import-only
        str(variant.stock_qty),
        str(final_price),
    ]



# Cell prefixes that spreadsheet apps (Excel/LibreOffice/Sheets) interpret as
# the start of a formula/DDE payload. A leading apostrophe forces the cell to
# be read as plain text — the standard OWASP CSV-injection mitigation.
_FORMULA_TRIGGER_CHARS = ("=", "+", "-", "@")


def _csv_safe(value: str) -> str:
    """Neutralize CSV-formula-injection payloads on export-only cells.

    Only applied at write time (never on import/read) so legitimately
    hyphen-prefixed or similar incoming values aren't garbled and round-trip
    fidelity is preserved.
    """
    if value.startswith(_FORMULA_TRIGGER_CHARS):
        return f"'{value}"
    return value


def write_csv(rows: list[list[str]], delimiter: str = ",") -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    writer.writerow(COLUMNS)
    for row in rows:
        writer.writerow([_csv_safe(cell) for cell in row])
    return buffer.getvalue()
