"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { api, type Category } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ArrowLeft, Package, Layers, Plus, Trash2 } from "lucide-react";

// ── Schemas ────────────────────────────────────────────────────────────────────

const variantSchema = z.object({
  sku: z.string().min(1, "SKU requerido"),
  name: z.string().min(1, "Nombre requerido"),
  price: z.string().optional(),
  stock_qty: z.number().int().min(0),
});

const baseSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  slug: z
    .string()
    .min(1, "Slug requerido")
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  description: z.string().optional(),
  image_url: z.string().url("URL inválida").optional().or(z.literal("")),
  category_id: z.string().optional(),
  made_to_order: z.boolean(),
  // simple mode
  simple_price: z.string().optional(),
  simple_stock: z.number().int().min(0).optional(),
  // variants mode
  variants: z.array(variantSchema).optional(),
});

type FormData = z.infer<typeof baseSchema>;
type Mode = "simple" | "variants";

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
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
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-green/25 focus:border-brand-green transition-all duration-150";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NuevoProductoPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
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
      made_to_order: false,
      simple_stock: 0,
      variants: [{ sku: "", name: "", price: "", stock_qty: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  const nameValue = useWatch({ control, name: "name" });

  useEffect(() => {
    if (nameValue) setValue("slug", slugify(nameValue), { shouldValidate: false });
  }, [nameValue, setValue]);

  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => {});
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setModeError(null);
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setModeError(null);

    // Validate mode-specific fields
    if (mode === "variants") {
      const vars = data.variants ?? [];
      if (vars.length === 0) {
        setModeError("Agregá al menos una variante.");
        return;
      }
      for (const v of vars) {
        if (!v.sku || !v.name) {
          setModeError("Completá SKU y nombre en todas las variantes.");
          return;
        }
      }
    }

    const token = getToken();
    if (!token) { router.replace("/login"); return; }

    try {
      const simplePrice = data.simple_price ? parseFloat(data.simple_price) : 0;

      const product = await api.products.create(
        {
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          image_url: data.image_url || null,
          category_id: data.category_id || null,
          made_to_order: data.made_to_order,
          base_price: mode === "simple" ? simplePrice : 0,
        },
        token
      );

      if (mode === "simple") {
        // One implicit variant
        await api.products.variants.create(
          product.id,
          {
            sku: data.slug,
            name: "Único",
            price: simplePrice || null,
            stock_qty: data.simple_stock ?? 0,
          },
          token
        );
      } else {
        await Promise.all(
          (data.variants ?? []).map((v) =>
            api.products.variants.create(
              product.id,
              {
                sku: v.sku,
                name: v.name,
                price: v.price ? parseFloat(v.price) : null,
                stock_qty: v.stock_qty,
              },
              token
            )
          )
        );
      }

      router.push("/dashboard/productos");
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error al crear el producto");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/productos"
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
          aria-label="Volver a productos"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            Nuevo producto
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Completá los datos del producto
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Product info card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
            Información del producto
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputField label="Nombre" required error={errors.name?.message}>
              <input
                type="text"
                placeholder="Ej: Panel Solar 400W"
                className={inputClass}
                {...register("name")}
              />
            </InputField>

            <InputField label="Slug (URL)" required error={errors.slug?.message}>
              <input
                type="text"
                placeholder="panel-solar-400w"
                className={`${inputClass} font-mono`}
                {...register("slug")}
              />
            </InputField>
          </div>

          <InputField label="Descripción" error={errors.description?.message}>
            <textarea
              rows={3}
              placeholder="Descripción del producto (opcional)"
              className={`${inputClass} resize-none`}
              {...register("description")}
            />
          </InputField>

          <InputField label="URL de imagen" error={errors.image_url?.message}>
            <input
              type="text"
              placeholder="https://..."
              className={inputClass}
              {...register("image_url")}
            />
          </InputField>

          <InputField label="Categoría" error={errors.category_id?.message}>
            <select className={inputClass} {...register("category_id")}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </InputField>

          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-brand-green"
              {...register("made_to_order")}
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
              Producto a pedido (sin stock administrado)
            </span>
          </label>
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
                  ? "bg-brand-green text-zinc-950"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Package className="w-4 h-4" />
              Producto simple
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
                  ? "bg-brand-green text-zinc-950"
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
                colores, talles…
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
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-green hover:opacity-80 transition-opacity cursor-pointer"
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
                          placeholder="Ej: Negro"
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
            href="/dashboard/productos"
            className="px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-brand-green text-zinc-950 text-sm font-medium px-6 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? "Guardando..." : "Crear producto"}
          </button>
        </div>
      </form>
    </div>
  );
}
