"""Shared CSV primitives for the product and supply import/export trios.

Pure functions only — no DB access, no product/supply-specific column names.
`product_csv.py` and `supply_csv.py` each own their own `COLUMNS`/`map_row`/
`serialize_row` and call into this module for the parts that would otherwise
drift between the two: decimal/boolean/attributes/iva_rate parsing, the
es-AR decimal-vs-thousands-separator guard, delimiter sniffing + BOM/cp1252
decoding, the OWASP CSV-formula-injection guard, and CSV writing.
"""
import csv
import io
import json
import re
from decimal import Decimal, InvalidOperation

from models.enums import IvaRate

_TRUE_TOKENS = {"true", "1", "yes", "si", "sí", "verdadero"}
_FALSE_TOKENS = {"false", "0", "no", "falso"}

# es-AR thousands-separator pattern, e.g. "1.234" or "1.234.567" — rejected so
# it can't be silently misread as a decimal (1.234 != mil doscientos treinta y cuatro).
_THOUSANDS_RE = re.compile(r"^\d{1,3}(\.\d{3})+$")

# Cell prefixes that spreadsheet apps (Excel/LibreOffice/Sheets) interpret as
# the start of a formula/DDE payload. A leading apostrophe forces the cell to
# be read as plain text — the standard OWASP CSV-injection mitigation.
_FORMULA_TRIGGER_CHARS = ("=", "+", "-", "@")


class RowError(Exception):
    """A per-row/per-cell validation failure. Carries a human message only, never a stack.

    `row_number` is optional — callers inside a per-row parsing loop already
    know the row number and don't need it on the exception; callers deeper
    inside group-write logic attach it so the outer handler can report the
    exact offending row instead of falling back to the group's first row.
    """

    def __init__(self, message: str, row_number: int | None = None):
        super().__init__(message)
        self.row_number = row_number


def decode_and_read(raw: bytes, columns: tuple[str, ...]) -> tuple[csv.DictReader, set[str]]:
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
    present = set(reader.fieldnames or []) & set(columns)
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


def _csv_safe(value: str) -> str:
    """Neutralize CSV-formula-injection payloads on export-only cells.

    Only applied at write time (never on import/read) so legitimately
    hyphen-prefixed or similar incoming values aren't garbled and round-trip
    fidelity is preserved.
    """
    if value.startswith(_FORMULA_TRIGGER_CHARS):
        return f"'{value}"
    return value


def write_csv(rows: list[list[str]], columns: tuple[str, ...], delimiter: str = ",") -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([_csv_safe(cell) for cell in row])
    return buffer.getvalue()
