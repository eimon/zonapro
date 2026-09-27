import type { CatalogSort, Currency } from "./api";
import { CATALOG_DEFAULT_CURRENCY } from "./format";

// Single source of truth for the store's filter state — always derived from
// the URL's search params, never kept as separate client state. Server page
// and client filter controls both import this so parsing/serialization never
// drifts apart.
export type StoreFilters = {
  q: string;
  category: string[];
  availability: string[];
  price: string[];
  sort: CatalogSort;
  page: number;
  currency: Currency;
};

const VALID_SORTS: CatalogSort[] = ["featured", "price_asc", "price_desc"];
const VALID_CURRENCIES: Currency[] = ["ARS", "USD"];

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseCurrencyValue(v: string | string[] | undefined): Currency | null {
  const value = typeof v === "string" ? v : undefined;
  return value && (VALID_CURRENCIES as string[]).includes(value) ? (value as Currency) : null;
}

// Resolves the effective currency for a request: the URL's `currency` param
// wins when present and valid, otherwise the `store_currency` cookie value
// (read by the caller via next/headers' cookies()), otherwise the catalog
// default. Exported directly for pages that don't need the full
// StoreFilters shape (package list/detail, product detail).
export function resolveStoreCurrency(
  sp: Record<string, string | string[] | undefined>,
  cookieCurrency?: string
): Currency {
  return parseCurrencyValue(sp.currency) ?? parseCurrencyValue(cookieCurrency) ?? CATALOG_DEFAULT_CURRENCY;
}

export function parseStoreFilters(
  sp: Record<string, string | string[] | undefined>,
  cookieCurrency?: string
): StoreFilters {
  const sort =
    typeof sp.sort === "string" && (VALID_SORTS as string[]).includes(sp.sort) ? (sp.sort as CatalogSort) : "featured";
  const pageRaw = typeof sp.page === "string" ? parseInt(sp.page, 10) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return {
    q: typeof sp.q === "string" ? sp.q : "",
    category: toArray(sp.category),
    availability: toArray(sp.availability),
    price: toArray(sp.price),
    sort,
    page,
    currency: resolveStoreCurrency(sp, cookieCurrency),
  };
}

// Serializes filters back into a query string, omitting empty/default values
// so URLs stay clean (no "?sort=featured&page=1" noise on the base view).
// `currency` follows the same omit-when-default convention as `sort`.
export function buildStoreQuery(filters: Partial<StoreFilters>): string {
  const qs = new URLSearchParams();
  if (filters.q) qs.set("q", filters.q);
  for (const c of filters.category ?? []) qs.append("category", c);
  for (const a of filters.availability ?? []) qs.append("availability", a);
  for (const p of filters.price ?? []) qs.append("price", p);
  if (filters.sort && filters.sort !== "featured") qs.set("sort", filters.sort);
  if (filters.page && filters.page > 1) qs.set("page", String(filters.page));
  if (filters.currency && filters.currency !== CATALOG_DEFAULT_CURRENCY) qs.set("currency", filters.currency);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : list.concat(value);
}

export function activeFilterCount(filters: StoreFilters): number {
  return filters.category.length + filters.availability.length + filters.price.length;
}
