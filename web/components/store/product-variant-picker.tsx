"use client";

import { useMemo, useState } from "react";
import type { Currency, ProductVariant } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { CurrencyToggle } from "@/components/store/currency-toggle";

function stockInfo(variant: ProductVariant, madeToOrder: boolean) {
  if (madeToOrder) {
    return { dot: "bg-orange-600", strong: "A pedido", suffix: null as string | null };
  }
  if (variant.stock_qty > 0) {
    return {
      dot: "bg-emerald-500",
      strong: "En stock",
      suffix:
        variant.stock_qty <= 3 ? `últimas ${variant.stock_qty} unidades` : `${variant.stock_qty} unidades disponibles`,
    };
  }
  return { dot: "bg-zinc-400 dark:bg-zinc-600", strong: "Sin stock", suffix: null as string | null };
}

function finalPrice(v: ProductVariant, currency: Currency): string | null {
  return currency === "ARS" ? v.final_price_ars : v.final_price_usd;
}

function netPrice(v: ProductVariant, currency: Currency): string | null {
  return currency === "ARS" ? v.price_ars : v.price_usd;
}

const OTHER_CURRENCY: Record<Currency, Currency> = { ARS: "USD", USD: "ARS" };

// The only interactive part of the product detail page: picking a variant
// re-renders price, stock and SKU. Everything else (breadcrumb, image,
// description, CTA, spec table) stays server-rendered around this island.
export function ProductVariantPicker({
  variants,
  madeToOrder,
  currency,
}: {
  variants: ProductVariant[];
  madeToOrder: boolean;
  currency: Currency;
}) {
  const availableVariants = useMemo(
    () => variants.filter((v) => finalPrice(v, currency) !== null),
    [variants, currency]
  );

  const [selectedId, setSelectedId] = useState(availableVariants[0]?.id ?? variants[0]?.id);

  // Currency can change without unmounting this component (URL/cookie
  // navigation re-renders the page with new props) — if the previously
  // selected variant has no price in the new currency, fall back to the
  // first one that does. Adjusted during render (React's documented pattern
  // for resetting state when a prop changes) rather than in an effect, to
  // avoid an extra render pass — mirrors StoreShell's qDraft/lastSyncedQ.
  const [lastCurrency, setLastCurrency] = useState(currency);
  if (currency !== lastCurrency) {
    setLastCurrency(currency);
    if (!availableVariants.some((v) => v.id === selectedId)) {
      setSelectedId(availableVariants[0]?.id);
    }
  }

  if (availableVariants.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-5 py-6">
        <p className="text-[15px] text-zinc-700 dark:text-zinc-300">
          Este producto no está disponible en {currency === "ARS" ? "pesos" : "dólares"} por el momento.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Mirálo en {OTHER_CURRENCY[currency]}:</span>
          <CurrencyToggle currency={currency} />
        </div>
      </div>
    );
  }

  const selected = availableVariants.find((v) => v.id === selectedId) ?? availableVariants[0];
  const info = stockInfo(selected, madeToOrder);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
            {formatMoney(finalPrice(selected, currency), currency)}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Precio sin impuestos: {formatMoney(netPrice(selected, currency), currency)}
          </span>
        </div>
        <CurrencyToggle currency={currency} />
      </div>

      {variants.length > 1 && (
        <fieldset className="border-0 m-0 p-0 flex flex-col">
          <legend className="pb-3 text-sm font-semibold text-zinc-900 dark:text-white">
            Variante: <span className="font-normal text-zinc-500 dark:text-zinc-400">{selected.name}</span>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {variants.map((v) => {
              const isSelected = v.id === selected.id;
              const price = finalPrice(v, currency);
              const disabled = price === null;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={disabled}
                  title={disabled ? `Sin precio en ${currency}` : undefined}
                  onClick={() => setSelectedId(v.id)}
                  className={`min-h-16 px-4 py-3 rounded-xl text-left flex flex-col gap-0.5 border transition-colors duration-150 ${
                    disabled
                      ? "opacity-40 cursor-not-allowed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
                      : isSelected
                      ? "cursor-pointer border-brand-blue bg-brand-blue/10 dark:bg-brand-blue/15"
                      : "cursor-pointer border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600"
                  }`}
                >
                  <span className="text-[15px] font-semibold text-zinc-900 dark:text-white">{v.name}</span>
                  <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
                    {disabled ? `Sin precio en ${currency}` : formatMoney(price, currency)}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
        <span className={`w-2 h-2 rounded-full ${info.dot}`} />
        <span>
          <strong className="font-semibold text-zinc-900 dark:text-white">{info.strong}</strong>
          {info.suffix ? ` · ${info.suffix}` : ""}
        </span>
        <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
          |
        </span>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-500">SKU {selected.sku}</span>
      </div>
    </div>
  );
}
