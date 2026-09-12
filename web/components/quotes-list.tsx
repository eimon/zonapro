"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Search } from "lucide-react";
import { api, Quote, QuoteStatus, QuoteType } from "@/lib/api";
import { getToken } from "@/lib/auth";

// Pure move (D18): identical body previously living in
// cotizaciones/page.tsx, parameterized by quoteType/title/newHref/
// newLabel/editHrefBase so it can be reused by the servicios list without
// touching the existing Cotizaciones page's markup, classes, or behavior.

const PAGE_SIZE_OPTIONS = [20, 30, 50] as const;

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

// Mirrors the backend's VALID_TRANSITIONS (api/services/quote_service.py) —
// forward-only, aprobada/rechazada/vencida are terminal. Sending is manual
// for now (no email/notification side effect), so "Enviar" is just a status
// flip like the rest. The three transitions out of "enviada" are consequential
// and hard to undo, so they ask for confirmation; borrador→enviada doesn't
// (it's the routine next step, confirming it on every quote would be noise).
const NEXT_STATUS_ACTIONS: Record<QuoteStatus, { status: QuoteStatus; label: string; confirmMessage?: string }[]> = {
  borrador: [{ status: "enviada", label: "Enviar" }],
  enviada: [
    { status: "aprobada", label: "Aprobar", confirmMessage: "¿Marcar esta cotización como aprobada?" },
    { status: "rechazada", label: "Rechazar", confirmMessage: "¿Marcar esta cotización como rechazada?" },
    { status: "vencida", label: "Marcar vencida", confirmMessage: "¿Marcar esta cotización como vencida?" },
  ],
  aprobada: [],
  rechazada: [],
  vencida: [],
};

type ExportFormat = "pdf" | "jpg";

function StatusActions({
  quote,
  busy,
  onChangeStatus,
  className = "",
}: {
  quote: Quote;
  busy: boolean;
  onChangeStatus: (quote: Quote, status: QuoteStatus, confirmMessage?: string) => void;
  className?: string;
}) {
  const actions = NEXT_STATUS_ACTIONS[quote.status];
  if (actions.length === 0) return null;

  // A single next step (borrador→enviada) reads better as its own button;
  // multiple options (out of "enviada") collapse into one compact select so
  // the row doesn't sprout three extra buttons next to Editar/Ver PDF/Ver JPG.
  if (actions.length === 1) {
    const action = actions[0];
    return (
      <button
        onClick={() => onChangeStatus(quote, action.status, action.confirmMessage)}
        disabled={busy}
        className={`inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors whitespace-nowrap ${className}`}
      >
        {busy ? "Guardando..." : action.label}
      </button>
    );
  }

  return (
    <select
      value=""
      onChange={(e) => {
        const action = actions.find((a) => a.status === e.target.value);
        if (action) onChangeStatus(quote, action.status, action.confirmMessage);
      }}
      disabled={busy}
      className={`rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 disabled:opacity-50 ${className}`}
    >
      <option value="" disabled>
        {busy ? "Guardando..." : "Cambiar estado"}
      </option>
      {actions.map((action) => (
        <option key={action.status} value={action.status}>
          {action.label}
        </option>
      ))}
    </select>
  );
}

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
  editHrefBase,
  statusBusy,
  onChangeStatus,
}: {
  quote: Quote;
  loadingFormat: ExportFormat | null;
  onExport: (id: string, format: ExportFormat) => void;
  editHrefBase: string;
  statusBusy: boolean;
  onChangeStatus: (quote: Quote, status: QuoteStatus, confirmMessage?: string) => void;
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
          href={`${editHrefBase}/${quote.id}/editar`}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
        <ExportButtons quote={quote} loadingFormat={loadingFormat} onExport={onExport} className="flex-1" />
        <StatusActions quote={quote} busy={statusBusy} onChangeStatus={onChangeStatus} />
      </div>
    </div>
  );
}

export type QuotesListProps = {
  quoteType: QuoteType;
  title: string;
  newHref: string;
  newLabel: string;
  editHrefBase: string;
};

export function QuotesList({ quoteType, title, newHref, newLabel, editHrefBase }: QuotesListProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ id: string; format: ExportFormat } | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / pageSize));

  const [paginationKey, setPaginationKey] = useState({ search, pageSize });
  if (paginationKey.search !== search || paginationKey.pageSize !== pageSize) {
    setPaginationKey({ search, pageSize });
    setPage(1);
  }

  const currentPage = Math.min(page, totalPages);
  const paginatedQuotes = useMemo(
    () => filteredQuotes.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredQuotes, currentPage, pageSize]
  );

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api.quotes
      .list(token, quoteType)
      .then(setQuotes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [quoteType]);

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

  async function handleStatusChange(quote: Quote, status: QuoteStatus, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const token = getToken();
    if (!token) return;
    setUpdatingStatusId(quote.id);
    try {
      const updated = await api.quotes.update(quote.id, { status }, token);
      setQuotes((prev) => prev.map((q) => (q.id === quote.id ? updated : q)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al cambiar el estado");
    } finally {
      setUpdatingStatusId(null);
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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">{title}</h1>
        <Link
          href={newHref}
          className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-[filter] hover:brightness-110 active:brightness-95"
        >
          {newLabel}
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
                {paginatedQuotes.map((quote) => (
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
                          href={`${editHrefBase}/${quote.id}/editar`}
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
                        <StatusActions
                          quote={quote}
                          busy={updatingStatusId === quote.id}
                          onChangeStatus={handleStatusChange}
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
            {paginatedQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                loadingFormat={exporting?.id === quote.id ? exporting.format : null}
                onExport={handleExport}
                editHrefBase={editHrefBase}
                statusBusy={updatingStatusId === quote.id}
                onChangeStatus={handleStatusChange}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
                className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>por página</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-zinc-900 transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-zinc-500 dark:text-zinc-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-zinc-900 transition-colors"
                aria-label="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
