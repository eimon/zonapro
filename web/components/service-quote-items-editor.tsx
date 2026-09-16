"use client";

import { useState } from "react";
import { Check, Plus, Pencil, Trash2, Wrench, X } from "lucide-react";
import type { Product, Supply } from "@/lib/api";

// New, structurally separate editor for the servicios flow (D7′ — NOT a
// tab on quote-items-editor.tsx). Offers three ways to add a line: a
// producto picker (kind=product), an insumo picker (kind=supply), and a
// manual concept+price form (kind=service). The server no longer enforces
// mutual exclusion between quote_type and item kind — both quote flows
// accept product, supply and service items (ALLOWED_ITEM_KINDS in
// services/quote_service.py) — so this editor mirrors quote-items-editor's
// product picker instead of rejecting it.
//
// Unlike the existing Cotizaciones edit page's known kind==="product"
// filter bug (obs #153), this editor's draft list never filters by kind —
// every item kind is always rendered (D20 anti-regression).

export type ServiceQuoteItemDraft =
  | {
      kind: "product";
      id?: string; // present once persisted (edit mode); absent for local/new items
      product_variant_id: string;
      product_name: string;
      product_sku: string;
      quantity: number;
      unit_price: string;
      iva_rate: string; // the product's IVA rate, snapshotted when the item is added
    }
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
  product: "Producto",
  supply: "Insumo",
  service: "Concepto",
};

const KIND_BADGE_CLASSES: Record<ServiceQuoteItemDraft["kind"], string> = {
  product: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  supply: "bg-brand-blue/10 text-brand-blue",
  service: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
};

function itemDescription(item: ServiceQuoteItemDraft): string {
  if (item.kind === "product") return item.product_name;
  if (item.kind === "supply") return item.supply_name;
  return item.service_description;
}

function itemSku(item: ServiceQuoteItemDraft): string | null {
  if (item.kind === "product") return item.product_sku;
  if (item.kind === "supply") return item.supply_sku;
  return null;
}

export function ServiceQuoteItemsEditor({
  products,
  supplies,
  items,
  onAdd,
  onUpdate,
  onRemove,
  contemplaIva,
}: {
  products: Product[];
  supplies: Supply[];
  items: ServiceQuoteItemDraft[];
  onAdd: (item: ServiceQuoteItemDraft) => void;
  onUpdate: (index: number, patch: Partial<Extract<ServiceQuoteItemDraft, { kind: "service" }>>) => void;
  onRemove: (index: number) => void;
  contemplaIva: boolean;
}) {
  // Producto picker state
  const [productVariantId, setProductVariantId] = useState("");
  const [productQuantity, setProductQuantity] = useState(1);

  // Insumo picker state
  const [supplyVariantId, setSupplyVariantId] = useState("");
  const [supplyQuantity, setSupplyQuantity] = useState(1);

  // Manual concept form state
  const [conceptDescription, setConceptDescription] = useState("");
  const [conceptUnitPrice, setConceptUnitPrice] = useState("");
  const [conceptQuantity, setConceptQuantity] = useState(1);
  const [conceptIvaRate, setConceptIvaRate] = useState("21");

  // Inline edit state — only ever active for a kind="service" row (manual
  // concept lines are the only ones with an edit affordance).
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editIvaRate, setEditIvaRate] = useState("21");

  const productVariantOptions = products.flatMap((product) =>
    product.variants.map((variant) => ({
      variantId: variant.id,
      label: `${product.name} — ${variant.name}`,
      sku: variant.sku,
      price: variant.price,
      ivaRate: product.iva_rate,
    }))
  );

  const supplyVariantOptions = supplies.flatMap((supply) =>
    supply.variants.map((variant) => ({
      variantId: variant.id,
      label: `${supply.name} — ${variant.name}`,
      sku: variant.sku,
      price: variant.price,
      ivaRate: supply.iva_rate,
    }))
  );

  function handleAddProduct() {
    const option = productVariantOptions.find((o) => o.variantId === productVariantId);
    if (!option || productQuantity < 1) return;
    onAdd({
      kind: "product",
      product_variant_id: option.variantId,
      product_name: option.label,
      product_sku: option.sku,
      quantity: productQuantity,
      unit_price: option.price ?? "0",
      iva_rate: option.ivaRate,
    });
    setProductVariantId("");
    setProductQuantity(1);
  }

  function handleAddSupply() {
    const option = supplyVariantOptions.find((o) => o.variantId === supplyVariantId);
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

  function startEditConcept(index: number, item: Extract<ServiceQuoteItemDraft, { kind: "service" }>) {
    setEditingIndex(index);
    setEditDescription(item.service_description);
    setEditQuantity(item.quantity);
    setEditUnitPrice(item.unit_price);
    setEditIvaRate(item.iva_rate);
  }

  function cancelEditConcept() {
    setEditingIndex(null);
  }

  function saveEditConcept(index: number) {
    if (!editDescription.trim() || !editUnitPrice || editQuantity < 1) return;
    onUpdate(index, {
      service_description: editDescription.trim(),
      quantity: editQuantity,
      unit_price: editUnitPrice,
      iva_rate: editIvaRate,
    });
    setEditingIndex(null);
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
              {items.map((item, index) => {
                const isEditing = item.kind === "service" && editingIndex === index;

                if (isEditing) {
                  return (
                    <tr key={item.id ?? `${item.kind}-${index}`}>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE_CLASSES[item.kind]}`}
                        >
                          {KIND_LABELS[item.kind]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className={inputClass}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min={1}
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className={`${inputClass} text-right`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editUnitPrice}
                          onChange={(e) => setEditUnitPrice(e.target.value)}
                          className={`${inputClass} text-right`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={editIvaRate}
                          onChange={(e) => setEditIvaRate(e.target.value)}
                          className={inputClass}
                        >
                          <option value="0">IVA 0%</option>
                          <option value="10.5">IVA 10.5%</option>
                          <option value="21">IVA 21%</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => saveEditConcept(index)}
                            disabled={!editDescription.trim() || !editUnitPrice}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                            aria-label="Guardar concepto"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditConcept}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                            aria-label="Cancelar edición"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
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
                      {itemSku(item) && (
                        <p className="text-xs text-zinc-400 font-mono">{itemSku(item)}</p>
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
                      <div className="flex items-center justify-end gap-1">
                        {item.kind === "service" && (
                          <button
                            type="button"
                            onClick={() => startEditConcept(index, item)}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors duration-150 cursor-pointer"
                            aria-label="Editar concepto"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemove(index)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                          aria-label="Quitar ítem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
          <Wrench className="w-6 h-6 text-zinc-300 dark:text-zinc-700" />
          <p className="text-sm text-zinc-400">Todavía no agregaste productos, insumos ni conceptos</p>
        </div>
      )}

      {/* Add producto row */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Agregar producto</h3>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <select
            value={productVariantId}
            onChange={(e) => setProductVariantId(e.target.value)}
            className={`${inputClass} sm:flex-1`}
          >
            <option value="">Seleccionar producto…</option>
            {productVariantOptions.map((o) => (
              <option key={o.variantId} value={o.variantId}>
                {o.label} ({o.sku})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={productQuantity}
            onChange={(e) => setProductQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={`${inputClass} sm:w-24`}
          />
          <button
            type="button"
            onClick={handleAddProduct}
            disabled={!productVariantId}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-[filter] duration-150 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </div>

      {/* Add insumo row */}
      <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">Agregar insumo</h3>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <select
            value={supplyVariantId}
            onChange={(e) => setSupplyVariantId(e.target.value)}
            className={`${inputClass} sm:flex-1`}
          >
            <option value="">Seleccionar insumo…</option>
            {supplyVariantOptions.map((o) => (
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
