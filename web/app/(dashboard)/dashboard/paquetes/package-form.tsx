"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import type { Product, Supply, PackageInput } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { PackageItemsEditor, type PackageItemDraft } from "@/components/package-items-editor";

// Shared by nuevo/page.tsx and [id]/editar/page.tsx — the pricing toggle +
// items editor + live preview logic is substantial enough to be worth
// sharing (unlike the insumos nuevo/editar pages, which stay duplicated
// because they're mostly plain fields).
//
// Pricing shapes (mirrors the API — see api/models/package.py):
//   - discount_percent mode: ONE percent, applies to both currencies alike.
//   - final_price mode: up to two independent NET final prices, one per
//     currency — either may be left empty (package then isn't available in
//     that currency).

const schema = z
  .object({
    name: z.string().min(1, "Nombre requerido"),
    slug: z.string().min(1, "Slug requerido"),
    description: z.string().optional(),
    is_active: z.boolean(),
    pricing_mode: z.enum(["final_price", "discount_percent"]),
    discount_percent: z.string().optional(),
    pricing_value_ars: z.string().optional(),
    pricing_value_usd: z.string().optional(),
  })
  .refine(
    (v) =>
      v.pricing_mode === "discount_percent"
        ? !!v.discount_percent?.trim()
        : !!v.pricing_value_ars?.trim() || !!v.pricing_value_usd?.trim(),
    {
      message: "Completá el precio promocional",
      path: ["discount_percent"],
    }
  );

type FormData = z.infer<typeof schema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function InputField({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150";

// Per-currency NET list/final price preview — client-side only, backend
// recomputes and validates on save (see PackageService._validate_pricing).
function computeCurrencyPreview(
  items: PackageItemDraft[],
  currency: "ars" | "usd",
  pricingMode: "final_price" | "discount_percent",
  discountPercent: number | null,
  pricingValue: number | null
) {
  const field = currency === "ars" ? "unit_price_ars" : "unit_price_usd";
  const pricedItems = items.filter((it) => it[field] !== null);
  const allPriced = items.length > 0 && pricedItems.length === items.length;
  if (!allPriced) return { listPrice: null, finalPrice: null, discountPercent: null };

  const listPrice = items.reduce((sum, it) => sum + parseFloat(it[field] as string) * it.quantity, 0);
  if (listPrice <= 0) return { listPrice, finalPrice: null, discountPercent: null };

  if (pricingMode === "discount_percent") {
    if (discountPercent === null) return { listPrice, finalPrice: null, discountPercent: null };
    return { listPrice, finalPrice: listPrice * (1 - discountPercent / 100), discountPercent };
  }
  if (pricingValue === null) return { listPrice, finalPrice: null, discountPercent: null };
  return { listPrice, finalPrice: pricingValue, discountPercent: (1 - pricingValue / listPrice) * 100 };
}

function CurrencyPricingPreview({
  currency,
  listPrice,
  finalPrice,
  discountPercent,
}: {
  currency: "ARS" | "USD";
  listPrice: number | null;
  finalPrice: number | null;
  discountPercent: number | null;
}) {
  return (
    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5 text-sm">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{currency}</p>
      {listPrice === null ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          No disponible — algún ítem no tiene precio en {currency}.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>Precio de lista (sin impuestos)</span>
            <span className="tabular-nums line-through">{formatMoney(listPrice, currency)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-white">
            <span>Precio final (sin impuestos)</span>
            <span className="tabular-nums">{finalPrice !== null ? formatMoney(finalPrice, currency) : "—"}</span>
          </div>
          {finalPrice !== null && discountPercent !== null && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Ahorro de {formatMoney(listPrice - finalPrice, currency)} (
              {discountPercent.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%)
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function PackageForm({
  mode,
  products,
  supplies,
  defaultValues,
  initialItems = [],
  onSubmit,
  submitLabel,
  cancelHref,
}: {
  mode: "create" | "edit";
  products: Product[];
  supplies: Supply[];
  defaultValues: FormData;
  initialItems?: PackageItemDraft[];
  onSubmit: (data: PackageInput) => Promise<void>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [items, setItems] = useState<PackageItemDraft[]>(initialItems);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues });

  const pricingMode = useWatch({ control, name: "pricing_mode" });
  const discountPercentValue = useWatch({ control, name: "discount_percent" });
  const pricingValueArsValue = useWatch({ control, name: "pricing_value_ars" });
  const pricingValueUsdValue = useWatch({ control, name: "pricing_value_usd" });

  const parsedDiscountPercent = (() => {
    const n = parseFloat((discountPercentValue ?? "").replace(",", "."));
    return Number.isNaN(n) || n <= 0 ? null : n;
  })();
  const parsedPricingValueArs = (() => {
    const n = parseFloat((pricingValueArsValue ?? "").replace(",", "."));
    return Number.isNaN(n) || n <= 0 ? null : n;
  })();
  const parsedPricingValueUsd = (() => {
    const n = parseFloat((pricingValueUsdValue ?? "").replace(",", "."));
    return Number.isNaN(n) || n <= 0 ? null : n;
  })();

  const previewArs = computeCurrencyPreview(items, "ars", pricingMode, parsedDiscountPercent, parsedPricingValueArs);
  const previewUsd = computeCurrencyPreview(items, "usd", pricingMode, parsedDiscountPercent, parsedPricingValueUsd);

  const handleAddItem = (item: PackageItemDraft) => {
    setItemsError(null);
    setItems((prev) => [...prev, { ...item, display_order: prev.length }]);
  };
  const handleUpdateQuantity = (index: number, quantity: number) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity } : it)));
  };
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, display_order: i })));
  };

  const submit = async (data: FormData) => {
    setServerError(null);
    setItemsError(null);

    if (items.length === 0) {
      setItemsError("Agregá al menos un producto o insumo al paquete.");
      return;
    }

    let discount_percent: number | null = null;
    let pricing_value_ars: number | null = null;
    let pricing_value_usd: number | null = null;

    if (data.pricing_mode === "discount_percent") {
      const n = parseFloat((data.discount_percent ?? "").replace(",", "."));
      if (Number.isNaN(n) || n <= 0 || n >= 100) {
        setItemsError("El porcentaje de descuento debe ser mayor a 0 y menor a 100.");
        return;
      }
      discount_percent = n;
    } else {
      const ars = data.pricing_value_ars ? parseFloat(data.pricing_value_ars.replace(",", ".")) : null;
      const usd = data.pricing_value_usd ? parseFloat(data.pricing_value_usd.replace(",", ".")) : null;
      if ((ars === null || Number.isNaN(ars) || ars <= 0) && (usd === null || Number.isNaN(usd) || usd <= 0)) {
        setItemsError("Ingresá un precio final mayor a 0 para al menos una moneda.");
        return;
      }
      pricing_value_ars = ars !== null && !Number.isNaN(ars) && ars > 0 ? ars : null;
      pricing_value_usd = usd !== null && !Number.isNaN(usd) && usd > 0 ? usd : null;
    }

    const payload: PackageInput = {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      is_active: data.is_active,
      pricing_mode: data.pricing_mode,
      discount_percent,
      pricing_value_ars,
      pricing_value_usd,
      items: items.map((item, index) => ({
        kind: item.kind,
        display_order: index,
        product_variant_id: item.product_variant_id,
        supply_variant_id: item.supply_variant_id,
        quantity: item.quantity,
      })),
    };

    try {
      await onSubmit(payload);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error al guardar el paquete");
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      {/* Package info card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Información del paquete</h2>

        <InputField label="Nombre" required error={errors.name?.message}>
          <input
            type="text"
            placeholder="Ej: Combo Climatización + Instalación"
            className={inputClass}
            {...register("name", {
              onChange: (e) => {
                if (mode === "create") setValue("slug", slugify(e.target.value), { shouldValidate: false });
              },
            })}
          />
        </InputField>

        <InputField label="Slug (URL)" required error={errors.slug?.message}>
          <input type="text" className={`${inputClass} font-mono`} {...register("slug")} />
        </InputField>

        <InputField label="Descripción" error={errors.description?.message}>
          <textarea
            rows={3}
            placeholder="Descripción del paquete (opcional)"
            className={`${inputClass} resize-none`}
            {...register("description")}
          />
        </InputField>

        <label className="flex items-center gap-3 cursor-pointer group w-fit">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-brand-blue"
            {...register("is_active")}
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            Paquete activo (visible en la tienda si además está disponible)
          </span>
        </label>
      </div>

      {/* Items card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Contenido del paquete</h2>
        {itemsError && <p className="text-xs text-red-500 dark:text-red-400">{itemsError}</p>}
        <PackageItemsEditor
          products={products}
          supplies={supplies}
          items={items}
          onAdd={handleAddItem}
          onUpdateQuantity={handleUpdateQuantity}
          onRemove={handleRemoveItem}
        />
      </div>

      {/* Pricing card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Precio promocional</h2>

        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setValue("pricing_mode", "final_price", { shouldValidate: true })}
            className={`px-4 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer ${
              pricingMode === "final_price"
                ? "bg-brand-blue text-white"
                : "bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Precio final
          </button>
          <button
            type="button"
            onClick={() => setValue("pricing_mode", "discount_percent", { shouldValidate: true })}
            className={`px-4 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer ${
              pricingMode === "discount_percent"
                ? "bg-brand-blue text-white"
                : "bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            % de descuento
          </button>
        </div>

        {pricingMode === "discount_percent" ? (
          <InputField label="Descuento (%) — aplica por igual en ARS y USD" required error={errors.discount_percent?.message}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              className={`${inputClass} sm:w-1/2`}
              {...register("discount_percent")}
            />
          </InputField>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputField label="Precio final ARS (neto)" error={errors.discount_percent?.message}>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Dejar vacío = no disponible en ARS"
                className={inputClass}
                {...register("pricing_value_ars")}
              />
            </InputField>
            <InputField label="Precio final USD (neto)">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Dejar vacío = no disponible en USD"
                className={inputClass}
                {...register("pricing_value_usd")}
              />
            </InputField>
          </div>
        )}

        <CurrencyPricingPreview
          currency="ARS"
          listPrice={previewArs.listPrice}
          finalPrice={previewArs.finalPrice}
          discountPercent={previewArs.discountPercent}
        />
        <CurrencyPricingPreview
          currency="USD"
          listPrice={previewUsd.listPrice}
          finalPrice={previewUsd.finalPrice}
          discountPercent={previewUsd.discountPercent}
        />
      </div>

      {serverError && <p className="text-sm text-red-500 dark:text-red-400 text-center">{serverError}</p>}

      <div className="flex items-center justify-end gap-3">
        <Link href={cancelHref} className="px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-brand-blue text-white text-sm font-medium px-6 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
