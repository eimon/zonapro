"use client";

import { useState } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";
import type { Supply } from "@/lib/api";

// New, structurally separate editor for the servicios flow (D7′ — NOT a
// tab on quote-items-editor.tsx). Offers exactly two ways to add a line:
// an insumo picker (kind=supply) and a manual concept+price form
// (kind=service). No product picker exists here — the server also
// enforces that kind=product is rejected on servicios quotes (D11).
//
// Unlike the existing Cotizaciones edit page's known kind==="product"
// filter bug (obs #153), this editor's draft list never filters by kind —
// both supply and service items are always rendered (D20 anti-regression).

export type ServiceQuoteItemDraft =
  | {
      kind: "supply";
      id?: string; // present once persisted (edit mode); absent for local/new items
      supply_variant_id: string;
      supply_name: string;
      supply_sku: string;
      quantity: number;
      unit_price: string;
      iva_rate: string; // the supply's IVA rate, snapshotted when the item is added
    }
  | {
      kind: "service";
      id?: string;
      service_description: string;
      quantity: number;
      unit_price: string;
      iva_rate: string;
    };

// Duplicated intentionally (D18): a 3-line formatter and a 1-line class
// string are not worth sharing across the two structurally separate editors.
const inputClass =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150";

function money(value: number) {
  return `$${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const KIND_LABELS: Record<ServiceQuoteItemDraft["kind"], string> = {
  supply: "Insumo",
  service: "Concepto",
};

const KIND_BADGE_CLASSES: Record<ServiceQuoteItemDraft["kind"], string> = {
  supply: "bg-brand-blue/10 text-brand-blue",
  service: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
};

function itemDescription(item: ServiceQuoteItemDraft): string {
  return item.kind === "supply" ? item.supply_name : item.service_description;
}

export function ServiceQuoteItemsEditor({
  supplies,
  items,
  onAdd,
  onRemove,
  contemplaIva,
}: {
  supplies: Supply[];
  items: ServiceQuoteItemDraft[];
  onAdd: (item: ServiceQuoteItemDraft) => void;
  onRemove: (index: number) => void;
  contemplaIva: boolean;
}) {
  // Insumo picker state
  const [supplyVariantId, setSupplyVariantId] = useState("");
  const [supplyQuantity, setSupplyQuantity] = useState(1);

  // Manual concept form state
  const [conceptDescription, setConceptDescription] = useState("");
  const [conceptUnitPrice, setConceptUnitPrice] = useState("");
  const [conceptQuantity, setConceptQuantity] = useState(1);
  const [conceptIvaRate, setConceptIvaRate] = useState("21");

  const variantOptions = supplies.flatMap((supply) =>
    supply.variants.map((variant) => ({
      variantId: variant.id,
      label: `${supply.name} — ${variant.name}`,
      sku: variant.sku,
      price: variant.price,
      ivaRate: supply.iva_rate,
    }))
  );

  function handleAddSupply() {
    const option = variantOptions.find((o) => o.variantId === supplyVariantId);
    if (!option || supplyQuantity < 1) return;
    onAdd({
      kind: "supply",
      supply_variant_id: option.variantId,
      supply_name: option.label,
      supply_sku: option.sku,
      quantity: supplyQuantity,
      unit_price: option.price ?? "0",
      iva_rate: option.ivaRate,
    });
    setSupplyVariantId("");
    setSupplyQuantity(1);
  }

  function handleAddConcept() {
    if (!conceptDescription.trim() || !conceptUnitPrice || conceptQuantity < 1) return;
    onAdd({
      kind: "service",
      service_description: conceptDescription.trim(),
      quantity: conceptQuantity,
      unit_price: conceptUnitPrice,
      iva_rate: conceptIvaRate,
    });
    setConceptDescription("");
    setConceptUnitPrice("");
    setConceptQuantity(1);
    setConceptIvaRate("21");
  }

  const subtotal = items.reduce(
    (sum, item) => sum + parseFloat(item.unit_price) * item.quantity,
    0
  );
  const ivaAmount = contemplaIva
    ? items.reduce(
        (sum, item) =>
          sum + (parseFloat(item.unit_price) * item.quantity * parseFloat(item.iva_rate || "0")) / 100,
        0
      )
    : 0;
  const total = subtotal + ivaAmount;

  return (
    <div className="space-y-5">
      {/* Item list — never filtered by kind (D20) */}
      {items.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Descripción
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
                <tr key={item.id ?? `${item.kind}-${index}`}>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE_CLASSES[item.kind]}`}
                    >
                      {KIND_LABELS[item.kind]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-zinc-900 dark:text-white">{itemDescription(item)}</p>
                    {item.kind === "supply" && (
                      <p className="text-xs text-zinc-400 font-mono">{item.supply_sku}</p>
                    )}
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
                      aria-label="Quitar ítem"
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
          <Wrench className="w-6 h-6 text-zinc-300 dark:text-zinc-700" />
          <p className="text-sm text-zinc-400">Todavía no agregaste insumos ni conceptos</p>
        </div>
      )}

      {/* Add insumo row */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Agregar insumo</h3>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <select
            value={supplyVariantId}
            onChange={(e) => setSupplyVariantId(e.target.value)}
            className={`${inputClass} sm:flex-1`}
          >
            <option value="">Seleccionar insumo…</option>
            {variantOptions.map((o) => (
              <option key={o.variantId} value={o.variantId}>
                {o.label} ({o.sku})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={supplyQuantity}
            onChange={(e) => setSupplyQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={`${inputClass} sm:w-24`}
          />
          <button
            type="button"
            onClick={handleAddSupply}
            disabled={!supplyVariantId}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-[filter] duration-150 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </div>

      {/* Add manual concept row */}
      <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">
          Agregar concepto manual
        </h3>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={conceptDescription}
            onChange={(e) => setConceptDescription(e.target.value)}
            placeholder="Ej. Instalación dicroicas"
            className={`${inputClass} sm:flex-1`}
          />
          <input
            type="number"
            min={1}
            value={conceptQuantity}
            onChange={(e) => setConceptQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={`${inputClass} sm:w-20`}
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={conceptUnitPrice}
            onChange={(e) => setConceptUnitPrice(e.target.value)}
            placeholder="Precio"
            className={`${inputClass} sm:w-32`}
          />
          <select
            value={conceptIvaRate}
            onChange={(e) => setConceptIvaRate(e.target.value)}
            className={`${inputClass} sm:w-28`}
          >
            <option value="0">IVA 0%</option>
            <option value="10.5">IVA 10.5%</option>
            <option value="21">IVA 21%</option>
          </select>
          <button
            type="button"
            onClick={handleAddConcept}
            disabled={!conceptDescription.trim() || !conceptUnitPrice}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-[filter] duration-150 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </div>

      {/* Totals — no installation-cost block (D15: not offered on servicios quotes) */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span>Precio sin impuestos</span>
          <span className="tabular-nums">{money(subtotal)}</span>
        </div>
        {contemplaIva && (
          <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>IVA</span>
            <span className="tabular-nums">{money(ivaAmount)}</span>
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
