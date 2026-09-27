"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Currency } from "@/lib/api";
import { CATALOG_DEFAULT_CURRENCY } from "@/lib/format";

// Same cookie the server pages read via next/headers' cookies() to resolve
// the effective currency when the URL has no ?currency= — see
// lib/store-filters.ts's resolveStoreCurrency(). Kept as a plain (non
// -httpOnly) cookie since it's just a per-viewer convenience, set from the
// client.
const CURRENCY_COOKIE = "store_currency";
const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const LABELS: Record<Currency, string> = { ARS: "ARS $", USD: "USD US$" };

// Plain module-level helper (not a component/hook body) so the compiler
// doesn't flag the `document.cookie` assignment as mutating an
// externally-defined value.
function setCurrencyCookie(value: Currency) {
  if (typeof document !== "undefined") {
    document.cookie = `${CURRENCY_COOKIE}=${value}; path=/; max-age=${CURRENCY_COOKIE_MAX_AGE}`;
  }
}

// Segmented ARS/USD control — used on every storefront page that shows a
// price (catalog, product detail, package list/detail). Preserves whatever
// other query params are already on the page (filters, sort, page) except
// `page` itself, which resets since a different currency can have a
// different result set.
export function CurrencyToggle({ currency, className = "" }: { currency: Currency; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setCurrency(next: Currency) {
    if (next === currency) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === CATALOG_DEFAULT_CURRENCY) {
      params.delete("currency"); // default — keep the URL clean
    } else {
      params.set("currency", next);
    }
    params.delete("page");
    setCurrencyCookie(next);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Moneda"
      className={`inline-flex items-center gap-0.5 rounded-[10px] border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5 ${className}`}
    >
      {(Object.keys(LABELS) as Currency[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={currency === c}
          onClick={() => setCurrency(c)}
          className={`h-8 px-3 rounded-[8px] text-[13px] font-semibold transition-colors duration-150 cursor-pointer ${
            currency === c
              ? "bg-brand-blue text-white"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          {LABELS[c]}
        </button>
      ))}
    </div>
  );
}
