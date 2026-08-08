"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, type InstallationCostType, type Product, type Quote } from "@/lib/api";
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function itemsFromQuote(quote: Quote): QuoteItemDraft[] {
  return quote.items
    .filter((item) => item.kind === "product")
    .map((item) => ({
      id: item.id,
      product_variant_id: item.product_variant_id ?? "",
      product_name: item.product_name_snapshot ?? "Producto",
      product_sku: item.product_sku_snapshot ?? "",
      quantity: item.quantity,
      unit_price: item.unit_price,
      iva_rate: item.iva_rate,
    }));
}

export default function EditarCotizacionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<QuoteItemDraft[]>([]);
  const [installationCostType, setInstallationCostType] = useState<InstallationCostType | "">("");
  const [installationCostValue, setInstallationCostValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemBusy, setItemBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const contemplaIva = useWatch({ control, name: "contempla_iva" });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([api.quotes.get(id, token), api.products.list()])
      .then(([q, prods]) => {
        setQuote(q);
        setProducts(prods);
        setItems(itemsFromQuote(q));
        setInstallationCostType(q.installation_cost_type ?? "");
        setInstallationCostValue(q.installation_cost_value ?? "");
        reset({
          title: q.title,
          client_name: q.client_name,
          client_email: q.client_email,
          client_phone: q.client_phone ?? "",
          validity_days: q.validity_days,
          notes: q.notes ?? "",
          cost_notes: q.cost_notes ?? "",
          margin_notes: q.margin_notes ?? "",
          internal_comments: q.internal_comments ?? "",
          contempla_iva: q.contempla_iva,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar la cotización"))
      .finally(() => setLoading(false));
  }, [id, router, reset]);

  async function handleAddItem(item: QuoteItemDraft) {
    const token = getToken();
    if (!token) return;
    setItemBusy(true);
    setError(null);
    try {
      const updated = await api.quotes.addItem(
        id,
        {
          kind: "product",
          product_variant_id: item.product_variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        },
        token
      );
      setQuote(updated);
      setItems(itemsFromQuote(updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar el producto");
    } finally {
      setItemBusy(false);
    }
  }

  async function handleRemoveItem(index: number) {
    const token = getToken();
    const target = items[index];
    if (!token || !target?.id) return;
    setItemBusy(true);
    setError(null);
    try {
      await api.quotes.removeItem(id, target.id, token);
      const updated = await api.quotes.get(id, token);
      setQuote(updated);
      setItems(itemsFromQuote(updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al quitar el producto");
    } finally {
      setItemBusy(false);
    }
  }

  async function onSubmit(data: FormData) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.quotes.update(
        id,
        {
          ...data,
          client_phone: data.client_phone || null,
          notes: data.notes || null,
          cost_notes: data.cost_notes || null,
          margin_notes: data.margin_notes || null,
          internal_comments: data.internal_comments || null,
          installation_cost_type: installationCostType || null,
          installation_cost_value: installationCostType ? installationCostValue || "0" : null,
        },
        token
      );
      router.push("/dashboard/cotizaciones");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los cambios");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando cotización...</p>;
  }

  if (!quote) {
    return (
      <p className="text-sm text-red-500 dark:text-red-400">
        {error ?? "Cotización no encontrada"}
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Editar cotización</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Modificá los datos, productos y costo de instalación de la cotización.
        </p>
        {quote.updated_by_id && (
          <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
            Última edición: {formatDateTime(quote.updated_at)} por {quote.updated_by_name}
          </p>
        )}
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
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
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
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
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
              className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
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
              className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
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
            className="block w-32 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
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
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-brand-green"
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
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
          />
        </div>

        {/* Products + installation cost */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Productos</p>
            {itemBusy && <p className="text-xs text-zinc-400">Guardando…</p>}
          </div>
          <QuoteItemsEditor
            products={products}
            items={items}
            onAdd={handleAddItem}
            onRemove={handleRemoveItem}
            installationCostType={installationCostType}
            installationCostValue={installationCostValue}
            onInstallationCostTypeChange={setInstallationCostType}
            onInstallationCostValueChange={setInstallationCostValue}
            contemplaIva={contemplaIva ?? true}
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
                className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Notas de margen
              </label>
              <textarea
                {...register("margin_notes")}
                rows={2}
                className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Comentarios internos
              </label>
              <textarea
                {...register("internal_comments")}
                rows={2}
                className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-zinc-950 transition-[filter] hover:brightness-110 active:brightness-95 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
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
