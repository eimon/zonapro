"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Quote, QuoteStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

const STATUS_COLORS: Record<QuoteStatus, string> = {
  borrador: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
  enviada: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  aprobada: "bg-brand-green/10 text-brand-green",
  rechazada: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  vencida: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

export default function CotizacionesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api.quotes
      .list(token)
      .then(setQuotes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleExportPdf(id: string) {
    const token = getToken();
    if (!token) return;
    setPdfLoading(id);
    try {
      const url = await api.quotes.exportPdf(id, token);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cotizacion-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al generar PDF");
    } finally {
      setPdfLoading(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando cotizaciones...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500 dark:text-red-400">Error: {error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Cotizaciones</h1>
        <Link
          href="/cotizaciones/nueva"
          className="inline-flex items-center gap-2 rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-zinc-950 transition-[filter] hover:brightness-110 active:brightness-95"
        >
          + Nueva cotización
        </Link>
      </div>

      {quotes.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay cotizaciones todavía.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-950/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Título
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Fecha
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white">
                    {quote.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                    <div>{quote.client_name}</div>
                    <div className="text-xs text-zinc-500">{quote.client_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[quote.status]
                      }`}
                    >
                      {STATUS_LABELS[quote.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {new Date(quote.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                    ${Number(quote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleExportPdf(quote.id)}
                      disabled={pdfLoading === quote.id}
                      className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                    >
                      {pdfLoading === quote.id ? "Generando..." : "Ver PDF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
