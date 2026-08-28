"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, type InstallationCostType, type Product } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { QuoteItemsEditor, type QuoteItemDraft } from "@/components/quote-items-editor";

const schema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  client_name: z.string().min(1, "El nombre del cliente es obligatorio"),
  client_email: z.string().email("Email inválido"),
  client_phone: z.string().optional(),
  validity_days: z.number().int().min(1, "Mínimo 1 día"),
  notes: z.string().optional(),
  cost_notes: z.string().optional(),
  margin_notes: z.string().optional(),
  internal_comments: z.string().optional(),
  contempla_iva: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function NuevaCotizacionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<QuoteItemDraft[]>([]);
  const [installationCostType, setInstallationCostType] = useState<InstallationCostType | "">("");
  const [installationCostValue, setInstallationCostValue] = useState("");

  useEffect(() => {
    api.products.list().then(setProducts).catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { validity_days: 30, contempla_iva: true },
  });

  const contemplaIva = useWatch({ control, name: "contempla_iva" });

  async function onSubmit(data: FormData) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.quotes.create(
        {
          ...data,
          client_phone: data.client_phone || null,
          notes: data.notes || null,
          cost_notes: data.cost_notes || null,
          margin_notes: data.margin_notes || null,
          internal_comments: data.internal_comments || null,
          installation_cost_type: installationCostType || null,
          installation_cost_value: installationCostType ? installationCostValue || "0" : null,
          items: items.map((item) => ({
            kind: "product",
            product_variant_id: item.product_variant_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        },
        token,
      );
      router.push("/dashboard/cotizaciones");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Nueva cotización</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Completá los datos para crear un borrador de cotización.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Título <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            {...register("title")}
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="Ej. Sistema domótico residencial"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.title.message}</p>
          )}
        </div>

        {/* Client name */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Nombre del cliente <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            {...register("client_name")}
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="Juan García"
          />
          {errors.client_name && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.client_name.message}</p>
          )}
        </div>

        {/* Client email + phone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Email <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              {...register("client_email")}
              type="email"
              className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder="juan@email.com"
            />
            {errors.client_email && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.client_email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Teléfono
            </label>
            <input
              {...register("client_phone")}
              className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder="+54 9 11 1234-5678"
            />
          </div>
        </div>

        {/* Validity */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Días de validez
          </label>
          <input
            {...register("validity_days", { valueAsNumber: true })}
            type="number"
            min={1}
            className="block w-32 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          {errors.validity_days && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.validity_days.message}</p>
          )}
        </div>

        {/* IVA */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-brand-blue"
              {...register("contempla_iva")}
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
              Incluir IVA en esta cotización
            </span>
          </label>
        </div>

        {/* Notes (visible to client) */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Notas para el cliente
          </label>
          <textarea
            {...register("notes")}
            rows={3}
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="Condiciones de pago, plazos, garantías..."
          />
        </div>

        {/* Products + installation cost */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-4">
            Productos
          </p>
          <QuoteItemsEditor
            products={products}
            items={items}
            onAdd={(item) => setItems((prev) => [...prev, item])}
            onRemove={(index) => setItems((prev) => prev.filter((_, i) => i !== index))}
            installationCostType={installationCostType}
            installationCostValue={installationCostValue}
            onInstallationCostTypeChange={setInstallationCostType}
            onInstallationCostValueChange={setInstallationCostValue}
            contemplaIva={contemplaIva}
          />
        </div>

        {/* Internal separator */}
        <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-4">
            Campos internos (no visibles para el cliente)
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Notas de costos
              </label>
              <textarea
                {...register("cost_notes")}
                rows={2}
                className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                placeholder="Desglose de costos internos..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Notas de margen
              </label>
              <textarea
                {...register("margin_notes")}
                rows={2}
                className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                placeholder="Margen aplicado, descuentos, etc..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Comentarios internos
              </label>
              <textarea
                {...register("internal_comments")}
                rows={2}
                className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                placeholder="Notas del equipo..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-[filter] hover:brightness-110 active:brightness-95 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/cotizaciones")}
            className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
