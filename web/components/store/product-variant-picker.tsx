"use client";

import { useState } from "react";
import type { ProductVariant } from "@/lib/api";
import { formatMoney } from "@/lib/format";

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

// The only interactive part of the product detail page: picking a variant
// re-renders price, stock and SKU. Everything else (breadcrumb, image,
// description, CTA, spec table) stays server-rendered around this island.
export function ProductVariantPicker({
  variants,
  madeToOrder,
}: {
  variants: ProductVariant[];
  madeToOrder: boolean;
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  if (!selected) return null;

  const info = stockInfo(selected, madeToOrder);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
          {formatMoney(selected.final_price)}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Precio sin impuestos: {formatMoney(selected.price)}
        </span>
      </div>

      {variants.length > 1 && (
        <fieldset className="border-0 m-0 p-0 flex flex-col">
          <legend className="pb-3 text-sm font-semibold text-zinc-900 dark:text-white">
            Variante: <span className="font-normal text-zinc-500 dark:text-zinc-400">{selected.name}</span>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {variants.map((v) => {
              const isSelected = v.id === selected.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(v.id)}
                  className={`min-h-16 px-4 py-3 rounded-xl text-left flex flex-col gap-0.5 border transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? "border-brand-blue bg-brand-blue/10 dark:bg-brand-blue/15"
                      : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600"
                  }`}
                >
                  <span className="text-[15px] font-semibold text-zinc-900 dark:text-white">{v.name}</span>
                  <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{formatMoney(v.final_price)}</span>
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
