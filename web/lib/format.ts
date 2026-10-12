// Shared es-AR money formatter for the storefront and dashboard — matches
// the approved design's "$ 254.100" / "$ 1.016.702,50" convention: no
// decimals when the amount is a whole value, exactly 2 decimals when it
// isn't. Same es-AR number format for both currencies — only the symbol
// differs ("$" for ARS, "US$" for USD), matching the PDF's convention
// (api/core/pdf.py CURRENCY_SYMBOLS).
// Package item quantities can be fractional (meters of cable, liters…) — the
// data model has no separate "unit" field, so this just renders the plain
// number, trimming to at most 2 decimals without forcing trailing zeros.
export type Currency = "ARS" | "USD";

export const CURRENCY_SYMBOLS: Record<Currency, string> = { ARS: "$", USD: "US$" };

// The store's default currency. USD because after the pricing migration
// only USD prices exist in the catalog by default — flip this one constant
// (and DEFAULT_QUOTE_CURRENCY on the api) once ARS prices are broadly
// populated.
export const CATALOG_DEFAULT_CURRENCY: Currency = "USD";

export function formatQty(value: number): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function formatMoney(value: string | number | null | undefined, currency: Currency = "USD"): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  const hasCents = Math.round(n * 100) % 100 !== 0;
  const formatted = n.toLocaleString("es-AR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOLS[currency]} ${formatted}`;
}
