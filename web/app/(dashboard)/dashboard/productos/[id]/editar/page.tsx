"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { api, type Category, type Product } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ProductImageField } from "@/components/product-image-field";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

// ── Schemas ────────────────────────────────────────────────────────────────────

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1, "SKU requerido"),
  name: z.string().min(1, "Nombre requerido"),
  price: z.string().optional(),
  stock_qty: z.number().int().min(0),
});

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  slug: z
    .string()
    .min(1, "Slug requerido")
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  description: z.string().optional(),
  image_url: z
    .string()
    .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), {
      message: "URL inválida",
    })
    .optional(),
  category_id: z.string().optional(),
  made_to_order: z.boolean(),
  is_active: z.boolean(),
  iva_rate: z.enum(["0", "10.5", "21"]),
  variants: z.array(variantSchema).min(1, "Agregá al menos una variante"),
});

type FormData = z.infer<typeof schema>;

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

export default function EditarProductoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [originalVariantIds, setOriginalVariantIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  useEffect(() => {
    Promise.all([api.products.get(id), api.categories.list()])
      .then(([p, cats]) => {
        setProduct(p);
        setCategories(cats);
        setOriginalVariantIds(p.variants.map((v) => v.id));
        reset({
          name: p.name,
          slug: p.slug,
          description: p.description ?? "",
          image_url: p.image_url ?? "",
          category_id: p.category_id ?? "",
          made_to_order: p.made_to_order,
          is_active: p.is_active,
          iva_rate: p.iva_rate,
          variants: p.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            name: v.name,
            price: v.price ?? "",
            stock_qty: v.stock_qty,
          })),
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      await api.products.update(
        id,
        {
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          image_url: data.image_url || null,
          category_id: data.category_id || null,
          made_to_order: data.made_to_order,
          is_active: data.is_active,
          iva_rate: data.iva_rate,
        },
        token
      );

      const currentIds = data.variants.filter((v) => v.id).map((v) => v.id as string);
      const deletedIds = originalVariantIds.filter((vid) => !currentIds.includes(vid));

      await Promise.all([
        ...data.variants.map((v) => {
          const payload = {
            sku: v.sku,
            name: v.name,
            price: v.price ? parseFloat(v.price) : null,
            stock_qty: v.stock_qty,
          };
          return v.id
            ? api.products.variants.update(v.id, payload, token)
            : api.products.variants.create(id, payload, token);
        }),
        ...deletedIds.map((vid) => api.products.variants.remove(vid, token)),
      ]);

      router.push("/dashboard/productos");
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error al guardar los cambios");
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando producto...</p>;
  }

  if (notFound || !product) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-500 dark:text-red-400">Producto no encontrado.</p>
        <Link href="/dashboard/productos" className="text-sm text-brand-green hover:underline">
          Volver a productos
        </Link>
      </div>
    );
  }

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
            Editar producto
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{product.name}</p>
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
              <input type="text" className={inputClass} {...register("name")} />
            </InputField>

            <InputField label="Slug (URL)" required error={errors.slug?.message}>
              <input type="text" className={`${inputClass} font-mono`} {...register("slug")} />
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

          <InputField label="Imagen" error={errors.image_url?.message}>
            <Controller
              control={control}
              name="image_url"
              render={({ field }) => (
                <ProductImageField value={field.value ?? ""} onChange={field.onChange} />
              )}
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

          <InputField label="Alícuota de IVA" required error={errors.iva_rate?.message}>
            <select className={`${inputClass} sm:w-1/2`} {...register("iva_rate")}>
              <option value="0">0%</option>
              <option value="10.5">10,5%</option>
              <option value="21">21%</option>
            </select>
          </InputField>

          <div className="flex flex-col gap-3">
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

            <label className="flex items-center gap-3 cursor-pointer group w-fit">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-brand-green"
                {...register("is_active")}
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                Producto activo (visible en la tienda)
              </span>
            </label>
          </div>
        </div>

        {/* Variants card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              Variantes
            </h2>
            <button
              type="button"
              onClick={() => append({ sku: "", name: "", price: "", stock_qty: 0 })}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-green hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar variante
            </button>
          </div>

          {errors.variants?.root?.message && (
            <p className="text-xs text-red-500 dark:text-red-400">{errors.variants.root.message}</p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-12 gap-3 p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div className="col-span-12 sm:col-span-3">
                  <InputField label="SKU" required error={errors.variants?.[index]?.sku?.message}>
                    <input
                      type="text"
                      className={`${inputClass} font-mono`}
                      {...register(`variants.${index}.sku`)}
                    />
                  </InputField>
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <InputField label="Nombre" required error={errors.variants?.[index]?.name?.message}>
                    <input type="text" className={inputClass} {...register(`variants.${index}.name`)} />
                  </InputField>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <InputField label="Precio (ARS)" error={errors.variants?.[index]?.price?.message}>
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
                  <InputField label="Stock" error={errors.variants?.[index]?.stock_qty?.message}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={inputClass}
                      {...register(`variants.${index}.stock_qty`, { valueAsNumber: true })}
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
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
