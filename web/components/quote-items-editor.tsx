"use client";

import { useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import type { InstallationCostType, Product } from "@/lib/api";

export type QuoteItemDraft = {
  id?: string; // present once persisted (edit mode); absent for local/new items
  product_variant_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: string;
  iva_rate: string; // the product's IVA rate, snapshotted when the item is added
};

const inputClass =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-green/25 focus:border-brand-green transition-all duration-150";

// Installation cost is always taxed at the standard rate when the quote contempla IVA.
const INSTALLATION_IVA_RATE = 21;

function money(value: number) {
  return `$${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function QuoteItemsEditor({
  products,
  items,
  onAdd,
  onRemove,
  installationCostType,
  installationCostValue,
  onInstallationCostTypeChange,
  onInstallationCostValueChange,
  contemplaIva,
}: {
  products: Product[];
  items: QuoteItemDraft[];
  onAdd: (item: QuoteItemDraft) => void;
  onRemove: (index: number) => void;
  installationCostType: InstallationCostType | "";
  installationCostValue: string;
  onInstallationCostTypeChange: (value: InstallationCostType | "") => void;
  onInstallationCostValueChange: (value: string) => void;
  contemplaIva: boolean;
}) {
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const variantOptions = products.flatMap((product) =>
    product.variants.map((variant) => ({
      variantId: variant.id,
      label: `${product.name} — ${variant.name}`,
      sku: variant.sku,
      price: variant.price,
      ivaRate: product.iva_rate,
    }))
  );

  function handleAdd() {
    const option = variantOptions.find((o) => o.variantId === variantId);
    if (!option || quantity < 1) return;
    onAdd({
      product_variant_id: option.variantId,
      product_name: option.label,
      product_sku: option.sku,
      quantity,
      unit_price: option.price ?? "0",
      iva_rate: option.ivaRate,
    });
    setVariantId("");
    setQuantity(1);
  }

  const productsSubtotal = items.reduce(
    (sum, item) => sum + parseFloat(item.unit_price) * item.quantity,
    0
  );
  const installationAmount =
    installationCostType === "fixed"
      ? parseFloat(installationCostValue || "0")
      : installationCostType === "percentage"
      ? (productsSubtotal * parseFloat(installationCostValue || "0")) / 100
      : 0;
  const itemsIvaAmount = contemplaIva
    ? items.reduce(
        (sum, item) =>
          sum + (parseFloat(item.unit_price) * item.quantity * parseFloat(item.iva_rate || "0")) / 100,
        0
      )
    : 0;
  const installationIvaAmount =
    contemplaIva && installationCostType ? (installationAmount * INSTALLATION_IVA_RATE) / 100 : 0;
  const ivaAmount = itemsIvaAmount + installationIvaAmount;
  const total = productsSubtotal + installationAmount + ivaAmount;

  return (
    <div className="space-y-5">
      {/* Item list */}
      {items.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Cant.
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Precio unit.
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Subtotal
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {items.map((item, index) => (
                <tr key={item.id ?? `${item.product_variant_id}-${index}`}>
                  <td className="px-4 py-2.5">
                    <p className="text-zinc-900 dark:text-white">{item.product_name}</p>
                    <p className="text-xs text-zinc-400 font-mono">{item.product_sku}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {money(parseFloat(item.unit_price))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-zinc-900 dark:text-white">
                    {money(parseFloat(item.unit_price) * item.quantity)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                      aria-label="Quitar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
          <Package className="w-6 h-6 text-zinc-300 dark:text-zinc-700" />
          <p className="text-sm text-zinc-400">Todavía no agregaste productos</p>
        </div>
      )}

      {/* Add item row */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className={`${inputClass} sm:flex-1`}
        >
          <option value="">Seleccionar producto…</option>
          {variantOptions.map((o) => (
            <option key={o.variantId} value={o.variantId}>
              {o.label} ({o.sku})
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className={`${inputClass} sm:w-24`}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!variantId}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-[filter] duration-150 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {/* Installation cost */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
          Costo de instalación
        </h3>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <select
            value={installationCostType}
            onChange={(e) => onInstallationCostTypeChange(e.target.value as InstallationCostType | "")}
            className={`${inputClass} sm:w-48`}
          >
            <option value="">Sin costo de instalación</option>
            <option value="fixed">Monto fijo</option>
            <option value="percentage">Porcentaje de productos</option>
          </select>
          {installationCostType && (
            <div className="relative sm:w-40">
              <input
                type="number"
                min={0}
                max={installationCostType === "percentage" ? 100 : undefined}
                step="0.01"
                value={installationCostValue}
                onChange={(e) => onInstallationCostValueChange(e.target.value)}
                placeholder={installationCostType === "percentage" ? "10" : "50000"}
                className={inputClass}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">
                {installationCostType === "percentage" ? "%" : "$"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span>Precio sin impuestos</span>
          <span className="tabular-nums">{money(productsSubtotal)}</span>
        </div>
        {contemplaIva && (
          <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>IVA</span>
            <span className="tabular-nums">{money(ivaAmount)}</span>
          </div>
        )}
        {installationCostType && (
          <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>Instalación{installationCostType === "percentage" ? ` (${installationCostValue || 0}%)` : ""}</span>
            <span className="tabular-nums">{money(installationAmount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-base font-semibold text-zinc-900 dark:text-white pt-1.5">
          <span>
            Total
            {!contemplaIva && (
              <span className="ml-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">(sin IVA)</span>
            )}
          </span>
          <span className="tabular-nums">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}
