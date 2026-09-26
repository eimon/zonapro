"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import type { Product, Supply, PackageInput } from "@/lib/api";
import { PackageItemsEditor, type PackageItemDraft } from "@/components/package-items-editor";

// Shared by nuevo/page.tsx and [id]/editar/page.tsx — the pricing toggle +
// items editor + live preview logic is substantial enough to be worth
// sharing (unlike the insumos nuevo/editar pages, which stay duplicated
// because they're mostly plain fields).

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  slug: z.string().min(1, "Slug requerido"),
  description: z.string().optional(),
  is_active: z.boolean(),
  pricing_mode: z.enum(["final_price", "discount_percent"]),
  pricing_value: z.string().min(1, "Requerido"),
});

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

function money(value: number) {
  return `$${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const pricingValue = useWatch({ control, name: "pricing_value" });

  // NET — the stored/pricing basis. pricing_value/pricing_mode always work
  // in these terms, matching the backend (core/package_pricing.py).
  const listPrice = items.reduce((sum, item) => sum + parseFloat(item.unit_price) * item.quantity, 0);
  // IVA-inclusive (gross) — each item's own IVA rate applied, then summed.
  // Used only to preview the customer-facing price; never sent to the API.
  const listPriceGross = items.reduce((sum, item) => {
    const rate = parseFloat(item.iva_rate) || 0;
    const grossUnit = parseFloat(item.unit_price) * (1 + rate / 100);
    return sum + grossUnit * item.quantity;
  }, 0);
  const parsedPricingValue = parseFloat((pricingValue ?? "").replace(",", "."));
  const hasValidPricingValue = !Number.isNaN(parsedPricingValue) && parsedPricingValue > 0;

  let computedFinalPrice: number | null = null;
  let computedDiscountPercent: number | null = null;
  if (listPrice > 0 && hasValidPricingValue) {
    if (pricingMode === "final_price") {
      computedFinalPrice = parsedPricingValue;
      computedDiscountPercent = (1 - parsedPricingValue / listPrice) * 100;
    } else {
      computedDiscountPercent = parsedPricingValue;
      computedFinalPrice = listPrice * (1 - parsedPricingValue / 100);
    }
  }
  // Same discount factor (final_price / list_price) applied to the gross
  // list price — mirrors core/package_pricing.py::compute_final_price_gross,
  // so mixed IVA rates (21% + 10.5%) are handled proportionally, not by
  // re-adding a single flat rate.
  const computedFinalPriceGross =
    computedFinalPrice !== null && listPrice > 0 ? (computedFinalPrice * listPriceGross) / listPrice : null;

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

    const pricingValueNumber = parseFloat(data.pricing_value.replace(",", "."));
    if (Number.isNaN(pricingValueNumber) || pricingValueNumber <= 0) {
      setItemsError(
        data.pricing_mode === "discount_percent"
          ? "El porcentaje de descuento debe ser mayor a 0."
          : "El precio final debe ser mayor a 0."
      );
      return;
    }

    const payload: PackageInput = {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      is_active: data.is_active,
      pricing_mode: data.pricing_mode,
      pricing_value: pricingValueNumber,
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InputField
            label={pricingMode === "final_price" ? "Precio final sin impuestos (ARS)" : "Descuento (%)"}
            required
            error={errors.pricing_value?.message}
          >
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={pricingMode === "final_price" ? "0.00" : "0"}
              className={inputClass}
              {...register("pricing_value")}
            />
          </InputField>

          <InputField
            label={pricingMode === "final_price" ? "Descuento resultante" : "Precio final sin impuestos resultante"}
          >
            <div className={`${inputClass} bg-zinc-100 dark:bg-zinc-900 cursor-default flex items-center`}>
              {pricingMode === "final_price"
                ? computedDiscountPercent !== null
                  ? `${computedDiscountPercent.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`
                  : "—"
                : computedFinalPrice !== null
                ? money(computedFinalPrice)
                : "—"}
            </div>
          </InputField>
        </div>

        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5 text-sm">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>Precio de lista (sin impuestos)</span>
            <span className="tabular-nums line-through">{money(listPrice)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-white">
            <span>Precio final (sin impuestos)</span>
            <span className="tabular-nums">{computedFinalPrice !== null ? money(computedFinalPrice) : "—"}</span>
          </div>
          {computedFinalPrice !== null && listPrice > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Ahorro de {money(listPrice - computedFinalPrice)} ({computedDiscountPercent?.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%)
            </p>
          )}
          <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
            <span>Precio final con IVA (vista de la tienda)</span>
            <span className="tabular-nums">{computedFinalPriceGross !== null ? money(computedFinalPriceGross) : "—"}</span>
          </div>
        </div>
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
