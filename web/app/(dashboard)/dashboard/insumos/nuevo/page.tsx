"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ArrowLeft, Boxes, Layers, Plus, Trash2 } from "lucide-react";

// ── Schemas ────────────────────────────────────────────────────────────────────

const variantSchema = z.object({
  sku: z.string().min(1, "SKU requerido"),
  name: z.string().min(1, "Nombre requerido"),
  price: z.string().min(1, "Precio requerido"),
  stock_qty: z.number().int().min(0),
});

const baseSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  description: z.string().optional(),
  iva_rate: z.enum(["0", "10.5", "21"]),
  price_input_mode: z.enum(["net", "final"]),
  // simple mode
  simple_price: z.string().optional(),
  simple_stock: z.number().int().min(0).optional(),
  // variants mode
  variants: z.array(variantSchema).optional(),
});

type FormData = z.infer<typeof baseSchema>;
type Mode = "simple" | "variants";

// ── Helpers ────────────────────────────────────────────────────────────────────

// Supplies have no slug (D1 — a partial unique index on `name` plays that
// role instead), so simple-mode's single implicit variant needs a generated
// SKU: derive it from the name the same way products derive their slug.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function priceHint(rawPrice: string | undefined, mode: "net" | "final", ivaRate: string): string | null {
  const value = rawPrice ? parseFloat(rawPrice) : NaN;
  if (!rawPrice || Number.isNaN(value)) return null;
  const rate = parseFloat(ivaRate) / 100;
  const converted = mode === "net" ? value * (1 + rate) : value / (1 + rate);
  const label = mode === "net" ? "final (con IVA)" : "neto (sin IVA)";
  return `= $${converted.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${label}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NuevoInsumoPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("simple");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      simple_stock: 0,
      iva_rate: "21",
      price_input_mode: "net",
      // Starts in "simple" mode — the variants array is only seeded when the
      // user switches to "variants" mode (see switchMode).
      variants: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  const nameValue = useWatch({ control, name: "name" });
  const simplePriceValue = useWatch({ control, name: "simple_price" });
  const ivaRateValue = useWatch({ control, name: "iva_rate" });
  const priceInputModeValue = useWatch({ control, name: "price_input_mode" });

  const switchMode = (next: Mode) => {
    setMode(next);
    setModeError(null);
    if (next === "simple") {
      // Drop the variants array entirely — variantSchema requires sku/name/price
      // on every row, so a leftover placeholder row would silently fail
      // validation (and block submission) even though it's not rendered.
      setValue("variants", []);
    } else if (next === "variants") {
      setValue("variants", [{ sku: "", name: "", price: "", stock_qty: 0 }]);
    }
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setModeError(null);

    // Validate mode-specific fields
    if (mode === "simple") {
      if (!data.simple_price) {
        setModeError("El precio es requerido.");
        return;
      }
    } else {
      const vars = data.variants ?? [];
      if (vars.length === 0) {
        setModeError("Agregá al menos una variante.");
        return;
      }
      for (const v of vars) {
        if (!v.sku || !v.name || !v.price) {
          setModeError("Completá SKU, nombre y precio en todas las variantes.");
          return;
        }
      }
    }

    const token = getToken();
    if (!token) { router.replace("/login"); return; }

    try {
      const variants =
        mode === "simple"
          ? [
              {
                sku: slugify(data.name) || "insumo",
                name: "Único",
                price: parseFloat(data.simple_price as string),
                price_input_mode: data.price_input_mode,
                stock_qty: data.simple_stock ?? 0,
              },
            ]
          : (data.variants ?? []).map((v) => ({
              sku: v.sku,
              name: v.name,
              price: parseFloat(v.price),
              price_input_mode: data.price_input_mode,
              stock_qty: v.stock_qty,
            }));

      await api.supplies.create(
        {
          name: data.name,
          description: data.description || null,
          iva_rate: data.iva_rate,
          variants,
        },
        token
      );

      router.push("/dashboard/insumos");
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error al crear el insumo");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/insumos"
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
          aria-label="Volver a insumos"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            Nuevo insumo
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Completá los datos del insumo
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Supply info card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
            Información del insumo
          </h2>

          <InputField label="Nombre" required error={errors.name?.message}>
            <input
              type="text"
              placeholder="Ej: Cable Solar 4mm"
              className={inputClass}
              {...register("name")}
            />
          </InputField>

          <InputField label="Descripción" error={errors.description?.message}>
            <textarea
              rows={3}
              placeholder="Descripción del insumo (opcional)"
              className={`${inputClass} resize-none`}
              {...register("description")}
            />
          </InputField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputField label="Alícuota de IVA" required error={errors.iva_rate?.message}>
              <select className={inputClass} {...register("iva_rate")}>
                <option value="0">0%</option>
                <option value="10.5">10,5%</option>
                <option value="21">21%</option>
              </select>
            </InputField>

            <InputField label="Modo de carga del precio" error={errors.price_input_mode?.message}>
              <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setValue("price_input_mode", "net", { shouldValidate: true })}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                    priceInputModeValue === "net"
                      ? "bg-brand-blue text-white"
                      : "bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  Neto (sin IVA)
                </button>
                <button
                  type="button"
                  onClick={() => setValue("price_input_mode", "final", { shouldValidate: true })}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                    priceInputModeValue === "final"
                      ? "bg-brand-blue text-white"
                      : "bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  Final (con IVA)
                </button>
              </div>
            </InputField>
          </div>
        </div>

        {/* Mode selector + pricing card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Mode toggle */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => switchMode("simple")}
              className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                mode === "simple"
                  ? "bg-brand-blue text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Boxes className="w-4 h-4" />
              Insumo simple
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  mode === "simple" ? "bg-zinc-950/10 text-zinc-950" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                }`}
              >
                sin variantes
              </span>
            </button>
            <div className="w-px bg-zinc-200 dark:bg-zinc-800" />
            <button
              type="button"
              onClick={() => switchMode("variants")}
              className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                mode === "variants"
                  ? "bg-brand-blue text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Layers className="w-4 h-4" />
              Con variantes
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  mode === "variants" ? "bg-zinc-950/10 text-zinc-950" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                }`}
              >
                medidas, presentaciones…
              </span>
            </button>
          </div>

          {/* Simple mode */}
          {mode === "simple" && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InputField label="Precio (ARS)" error={errors.simple_price?.message}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={inputClass}
                  {...register("simple_price")}
                />
                {priceHint(simplePriceValue, priceInputModeValue, ivaRateValue) && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {priceHint(simplePriceValue, priceInputModeValue, ivaRateValue)}
                  </p>
                )}
              </InputField>

              <InputField label="Stock disponible" error={errors.simple_stock?.message}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  className={inputClass}
                  {...register("simple_stock", { valueAsNumber: true })}
                />
              </InputField>
            </div>
          )}

          {/* Variants mode */}
          {mode === "variants" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  Cada variante tiene su propio precio y stock.
                </p>
                <button
                  type="button"
                  onClick={() => append({ sku: "", name: "", price: "", stock_qty: 0 })}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar variante
                </button>
              </div>

              {modeError && <p className="text-xs text-red-500 dark:text-red-400">{modeError}</p>}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-12 gap-3 p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-lg border border-zinc-200 dark:border-zinc-800"
                  >
                    <div className="col-span-12 sm:col-span-3">
                      <InputField
                        label="SKU"
                        required
                        error={errors.variants?.[index]?.sku?.message}
                      >
                        <input
                          type="text"
                          placeholder="SKU-001"
                          className={`${inputClass} font-mono`}
                          {...register(`variants.${index}.sku`)}
                        />
                      </InputField>
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <InputField
                        label="Nombre"
                        required
                        error={errors.variants?.[index]?.name?.message}
                      >
                        <input
                          type="text"
                          placeholder="Ej: Rollo 100m"
                          className={inputClass}
                          {...register(`variants.${index}.name`)}
                        />
                      </InputField>
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <InputField
                        label="Precio (ARS)"
                        error={errors.variants?.[index]?.price?.message}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className={inputClass}
                          {...register(`variants.${index}.price`)}
                        />
                      </InputField>
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <InputField
                        label="Stock"
                        error={errors.variants?.[index]?.stock_qty?.message}
                      >
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          className={inputClass}
                          {...register(`variants.${index}.stock_qty`, {
                            valueAsNumber: true,
                          })}
                        />
                      </InputField>
                    </div>
                    {fields.length > 1 && (
                      <div className="col-span-1 flex items-end justify-end pb-0.5">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-2 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                          aria-label="Eliminar variante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-500 dark:text-red-400 text-center">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/insumos"
            className="px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-brand-blue text-white text-sm font-medium px-6 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? "Guardando..." : "Crear insumo"}
          </button>
        </div>
      </form>
    </div>
  );
}
