"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Trash2, PackageIcon, Boxes } from "lucide-react";
import type { Product, Supply } from "@/lib/api";

// Mirrors service-quote-items-editor.tsx's picker + parseDecimalQuantity
// approach, trimmed to the two kinds a package can hold (no manual concept
// lines — a package is strictly a bundle of catalog products/supplies).
export type PackageItemDraft = {
  id?: string; // present once persisted (edit mode); absent for local/new items
  kind: "product" | "supply";
  product_variant_id?: string;
  supply_variant_id?: string;
  name: string;
  sku: string;
  unit_price: string; // NET — snapshot of the catalog price at the moment it was added — live preview only, backend recomputes on save
  iva_rate: string; // the parent product's/supply's IVA rate — used to preview the IVA-inclusive price
  quantity: number;
  display_order: number;
  image_url?: string | null; // the parent product's/supply's image — preview only, same rationale as unit_price
};

const inputClass =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150";

const KIND_LABELS: Record<PackageItemDraft["kind"], string> = {
  product: "Producto",
  supply: "Insumo",
};

const KIND_BADGE_CLASSES: Record<PackageItemDraft["kind"], string> = {
  product: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  supply: "bg-brand-blue/10 text-brand-blue",
};

function money(value: number) {
  return `$${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Supplies accept fractional quantities (e.g. 2.5 m of cable); products stay
// whole units (validated server-side too). Returns null for empty/invalid/<=0.
function parseDecimalQuantity(value: string): number | null {
  const n = Math.round(parseFloat(value.replace(",", ".")) * 100) / 100;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PackageItemsEditor({
  products,
  supplies,
  items,
  onAdd,
  onUpdateQuantity,
  onRemove,
}: {
  products: Product[];
  supplies: Supply[];
  items: PackageItemDraft[];
  onAdd: (item: PackageItemDraft) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
}) {
  const [productVariantId, setProductVariantId] = useState("");
  const [productQuantity, setProductQuantity] = useState(1);

  const [supplyVariantId, setSupplyVariantId] = useState("");
  const [supplyQuantity, setSupplyQuantity] = useState("1");

  const productVariantOptions = products.flatMap((product) =>
    product.variants.map((variant) => ({
      variantId: variant.id,
      label: `${product.name} — ${variant.name}`,
      sku: variant.sku,
      price: variant.price,
      ivaRate: product.iva_rate,
      imageUrl: product.image_url,
    }))
  );

  const supplyVariantOptions = supplies.flatMap((supply) =>
    supply.variants.map((variant) => ({
      variantId: variant.id,
      label: `${supply.name} — ${variant.name}`,
      sku: variant.sku,
      price: variant.price,
      ivaRate: supply.iva_rate,
      imageUrl: supply.image_url,
    }))
  );

  function handleAddProduct() {
    const option = productVariantOptions.find((o) => o.variantId === productVariantId);
    if (!option || productQuantity < 1) return;
    onAdd({
      kind: "product",
      product_variant_id: option.variantId,
      name: option.label,
      sku: option.sku,
      unit_price: option.price ?? "0",
      iva_rate: option.ivaRate,
      quantity: productQuantity,
      display_order: items.length,
      image_url: option.imageUrl,
    });
    setProductVariantId("");
    setProductQuantity(1);
  }

  function handleAddSupply() {
    const option = supplyVariantOptions.find((o) => o.variantId === supplyVariantId);
    const quantity = parseDecimalQuantity(supplyQuantity);
    if (!option || quantity === null) return;
    onAdd({
      kind: "supply",
      supply_variant_id: option.variantId,
      name: option.label,
      sku: option.sku,
      unit_price: option.price ?? "0",
      iva_rate: option.ivaRate,
      quantity,
      display_order: items.length,
      image_url: option.imageUrl,
    });
    setSupplyVariantId("");
    setSupplyQuantity("1");
  }

  const listPrice = items.reduce((sum, item) => sum + parseFloat(item.unit_price) * item.quantity, 0);

  return (
    <div className="space-y-5">
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
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center">
                        {item.image_url ? (
                          <Image src={item.image_url} alt={item.name} fill sizes="28px" className="object-cover" />
                        ) : item.kind === "product" ? (
                          <PackageIcon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                        ) : (
                          <Boxes className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-zinc-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-xs text-zinc-400 font-mono truncate">{item.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={item.kind === "product" ? 1 : 0.01}
                      step={item.kind === "product" ? 1 : 0.01}
                      value={item.quantity}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = item.kind === "product" ? parseInt(raw, 10) : parseDecimalQuantity(raw);
                        if (parsed !== null && !Number.isNaN(parsed) && parsed > 0) onUpdateQuantity(index, parsed);
                      }}
                      className={`${inputClass} text-right w-24 ml-auto`}
                    />
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
          <PackageIcon className="w-6 h-6 text-zinc-300 dark:text-zinc-700" />
          <p className="text-sm text-zinc-400">Todavía no agregaste productos ni insumos</p>
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
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3 flex items-center gap-1.5">
          <Boxes className="w-3.5 h-3.5" />
          Agregar insumo
        </h3>
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
            min={0.01}
            step="0.01"
            value={supplyQuantity}
            onChange={(e) => setSupplyQuantity(e.target.value)}
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

      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">Precio de lista (sin impuestos)</span>
        <span className="text-base font-semibold text-zinc-900 dark:text-white tabular-nums">{money(listPrice)}</span>
      </div>
    </div>
  );
}
