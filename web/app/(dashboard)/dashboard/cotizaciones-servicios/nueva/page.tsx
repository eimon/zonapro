"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, type Product, type Supply } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ServiceQuoteItemsEditor, type ServiceQuoteItemDraft } from "@/components/service-quote-items-editor";
import { quoteFormSchema, type QuoteFormValues } from "@/lib/quote-form";
import { QuoteClientFields, QuoteInternalFields } from "@/components/quote-form-fields";

type FormData = QuoteFormValues;

function itemToPayload(item: ServiceQuoteItemDraft) {
  if (item.kind === "product") {
    return {
      kind: "product",
      product_variant_id: item.product_variant_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    };
  }
  if (item.kind === "supply") {
    return {
      kind: "supply",
      supply_variant_id: item.supply_variant_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    };
  }
  return {
    kind: "service",
    service_description: item.service_description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    iva_rate: item.iva_rate,
  };
}

export default function NuevaCotizacionServiciosPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [items, setItems] = useState<ServiceQuoteItemDraft[]>([]);

  useEffect(() => {
    api.products.list().then(setProducts).catch(() => {});
    const token = getToken();
    if (!token) return;
    api.supplies.list(token).then(setSupplies).catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(quoteFormSchema),
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
          quote_type: "servicios",
          client_phone: data.client_phone || null,
          notes: data.notes || null,
          cost_notes: data.cost_notes || null,
          margin_notes: data.margin_notes || null,
          internal_comments: data.internal_comments || null,
          // No installation cost on servicios quotes (D15) — the
          // installation itself is expressed as a manual concept line.
          installation_cost_type: null,
          installation_cost_value: null,
          items: items.map(itemToPayload),
        },
        token,
      );
      router.push("/dashboard/cotizaciones-servicios");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Nueva cotización de servicios</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Completá los datos para crear un borrador de cotización de servicios.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <QuoteClientFields register={register} errors={errors} />

        {/* Productos + insumos + conceptos manuales */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-4">
            Productos, insumos y conceptos
          </p>
          <ServiceQuoteItemsEditor
            products={products}
            supplies={supplies}
            items={items}
            onAdd={(item) => setItems((prev) => [...prev, item])}
            onUpdate={(index, patch) =>
              setItems((prev) =>
                prev.map((it, i) => (i === index && it.kind === "service" ? { ...it, ...patch } : it))
              )
            }
            onRemove={(index) => setItems((prev) => prev.filter((_, i) => i !== index))}
            contemplaIva={contemplaIva}
          />
        </div>

        <QuoteInternalFields register={register} />

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
            onClick={() => router.push("/dashboard/cotizaciones-servicios")}
            className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
