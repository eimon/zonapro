// Shared es-AR money formatter for the public storefront (store, product and
// package detail pages) — matches the approved design's "$ 254.100" /
// "$ 1.016.702,50" convention: no decimals when the amount is a whole peso
// value, exactly 2 decimals when it isn't.
// Package item quantities can be fractional (meters of cable, liters…) — the
// data model has no separate "unit" field, so this just renders the plain
// number, trimming to at most 2 decimals without forcing trailing zeros.
export function formatQty(value: number): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return `$ ${n.toLocaleString("es-AR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
