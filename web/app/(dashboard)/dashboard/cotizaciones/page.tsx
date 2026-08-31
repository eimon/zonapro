"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Search } from "lucide-react";
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
  aprobada: "bg-brand-blue/10 text-brand-blue",
  rechazada: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  vencida: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

type ExportFormat = "pdf" | "jpg";

function ExportButtons({
  quote,
  loadingFormat,
  onExport,
  className = "",
}: {
  quote: Quote;
  loadingFormat: ExportFormat | null;
  onExport: (id: string, format: ExportFormat) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => onExport(quote.id, "pdf")}
        disabled={loadingFormat !== null}
        className="flex-1 inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {loadingFormat === "pdf" ? "Generando..." : "Ver PDF"}
      </button>
      <button
        onClick={() => onExport(quote.id, "jpg")}
        disabled={loadingFormat !== null}
        className="flex-1 inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {loadingFormat === "jpg" ? "Generando..." : "Ver JPG"}
      </button>
    </div>
  );
}

function QuoteCard({
  quote,
  loadingFormat,
  onExport,
}: {
  quote: Quote;
  loadingFormat: ExportFormat | null;
  onExport: (id: string, format: ExportFormat) => void;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-zinc-900 dark:text-white truncate">{quote.title}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{quote.client_name}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{quote.client_email}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_COLORS[quote.status]
          }`}
        >
          {STATUS_LABELS[quote.status]}
        </span>
      </div>

      <div className="mt-3.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex items-end justify-between gap-3">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          <div>{new Date(quote.created_at).toLocaleDateString("es-AR")}</div>
          {quote.updated_by_id && (
            <div className="text-zinc-400 dark:text-zinc-500">
              Editada {new Date(quote.updated_at).toLocaleDateString("es-AR")}
              {quote.updated_by_name ? ` por ${quote.updated_by_name}` : ""}
            </div>
          )}
        </div>
        <p className="text-base font-semibold text-zinc-900 dark:text-white tabular-nums">
          ${Number(quote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <Link
          href={`/dashboard/cotizaciones/${quote.id}/editar`}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
        <ExportButtons quote={quote} loadingFormat={loadingFormat} onExport={onExport} className="flex-1" />
      </div>
    </div>
  );
}

export default function CotizacionesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ id: string; format: ExportFormat } | null>(null);
  const [search, setSearch] = useState("");

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return quotes;
    return quotes.filter(
      (quote) =>
        quote.title.toLowerCase().includes(query) ||
        quote.client_name.toLowerCase().includes(query) ||
        quote.client_email.toLowerCase().includes(query)
    );
  }, [quotes, search]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api.quotes
      .list(token)
      .then(setQuotes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleExport(id: string, format: ExportFormat) {
    const token = getToken();
    if (!token) return;
    setExporting({ id, format });
    try {
      const url =
        format === "pdf" ? await api.quotes.exportPdf(id, token) : await api.quotes.exportJpg(id, token);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cotizacion-${id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : `Error al generar ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
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
          href="/dashboard/cotizaciones/nueva"
          className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-[filter] hover:brightness-110 active:brightness-95"
        >
          + Nueva cotización
        </Link>
      </div>

      {quotes.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay cotizaciones todavía.</p>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, cliente o email..."
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
            />
          </div>

          {filteredQuotes.length === 0 ? (
            <p className="text-sm text-zinc-500">No se encontraron cotizaciones para &quot;{search}&quot;.</p>
          ) : (
            <>
          {/* Table (desktop) */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <table className="min-w-[820px] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
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
                {filteredQuotes.map((quote) => (
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
                      <div>{new Date(quote.created_at).toLocaleDateString("es-AR")}</div>
                      {quote.updated_by_id && (
                        <div className="text-xs text-zinc-400 dark:text-zinc-500">
                          Editada {new Date(quote.updated_at).toLocaleDateString("es-AR")}
                          {quote.updated_by_name ? ` por ${quote.updated_by_name}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                      ${Number(quote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/dashboard/cotizaciones/${quote.id}/editar`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </Link>
                        <ExportButtons
                          quote={quote}
                          loadingFormat={exporting?.id === quote.id ? exporting.format : null}
                          onExport={handleExport}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-3">
            {filteredQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                loadingFormat={exporting?.id === quote.id ? exporting.format : null}
                onExport={handleExport}
              />
            ))}
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
