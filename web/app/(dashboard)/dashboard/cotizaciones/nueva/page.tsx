"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, type InstallationCostType, type Product, type Supply } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { QuoteItemsEditor, type QuoteItemDraft } from "@/components/quote-items-editor";
import { quoteFormSchema, type QuoteFormValues } from "@/lib/quote-form";
import { QuoteClientFields, QuoteInternalFields } from "@/components/quote-form-fields";

type FormData = QuoteFormValues;

export default function NuevaCotizacionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [items, setItems] = useState<QuoteItemDraft[]>([]);
  const [installationCostType, setInstallationCostType] = useState<InstallationCostType | "">("");
  const [installationCostValue, setInstallationCostValue] = useState("");

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
          client_phone: data.client_phone || null,
          notes: data.notes || null,
          cost_notes: data.cost_notes || null,
          margin_notes: data.margin_notes || null,
          internal_comments: data.internal_comments || null,
          installation_cost_type: installationCostType || null,
          installation_cost_value: installationCostType ? installationCostValue || "0" : null,
          items: items.map((item) =>
            item.kind === "supply"
              ? {
                  kind: "supply",
                  supply_variant_id: item.supply_variant_id,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                }
              : {
                  kind: "product",
                  product_variant_id: item.product_variant_id,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                }
          ),
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
        <QuoteClientFields register={register} errors={errors} />

        {/* Products + supplies + installation cost */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-4">
            Productos e insumos
          </p>
          <QuoteItemsEditor
            products={products}
            supplies={supplies}
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
