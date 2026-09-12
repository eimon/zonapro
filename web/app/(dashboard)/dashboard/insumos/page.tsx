"use client";

import { useEffect, useState } from "react";
import { api, type Supply, type SupplyImportReport } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Link from "next/link";
import { Boxes, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { CsvPanel } from "@/components/csv-panel";

function totalStock(s: Supply) {
  return s.variants.reduce((sum, v) => sum + v.stock_qty, 0);
}

function lowestPrice(s: Supply): number | null {
  const prices = s.variants
    .map((v) => parseFloat(v.price))
    .filter((price) => !Number.isNaN(price));
  return prices.length ? Math.min(...prices) : null;
}

function SkeletonRow() {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>
      </td>
      {[...Array(3)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3.5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </td>
      ))}
      <td className="px-6 py-4" />
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
        <Boxes className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {search ? "Sin resultados para tu búsqueda" : "No hay insumos todavía"}
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
        {search ? "Probá con otro término" : "Creá el primer insumo para empezar"}
      </p>
    </div>
  );
}

function SupplyCard({
  supply,
  onDelete,
}: {
  supply: Supply;
  onDelete: (supply: Supply) => void;
}) {
  const stock = totalStock(supply);
  const price = lowestPrice(supply);
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
          <Boxes className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-900 dark:text-white truncate">{supply.name}</p>
          {supply.description && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{supply.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/dashboard/insumos/${supply.id}/editar`}
            title="Editar"
            className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors duration-150 cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </Link>
          <button
            title="Eliminar"
            onClick={() => onDelete(supply)}
            className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-3.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
        <div>
          <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Variantes</p>
          <p className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">{supply.variants.length}</p>
        </div>
        <div>
          <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Stock</p>
          {stock === 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
              Sin stock
            </span>
          ) : (
            <p className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">{stock} u.</p>
          )}
        </div>
        <div>
          <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Precio desde</p>
          <p className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
            {price !== null ? (
              `$${price.toLocaleString("es-AR")}`
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500 font-normal">Sin precio</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Estado</p>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium border ${
              supply.is_active
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            {supply.is_active ? "Activo" : "Inactivo"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function InsumosPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<SupplyImportReport | null>(null);

  const loadSupplies = () => {
    const token = getToken();
    if (!token) return Promise.resolve();
    return api.supplies.list(token).then(setSupplies).catch(() => {});
  };

  useEffect(() => {
    loadSupplies().finally(() => setLoading(false));
  }, []);

  const handleImported = (report: SupplyImportReport) => {
    setImportReport(report);
    if (!report.dry_run) {
      loadSupplies();
    }
  };

  const handleDelete = async (supply: Supply) => {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`¿Eliminar "${supply.name}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    try {
      await api.supplies.remove(supply.id, token);
      setSupplies((prev) => prev.filter((s) => s.id !== supply.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar el insumo");
    }
  };

  const filtered = supplies.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            Insumos
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {loading
              ? "Cargando catálogo…"
              : `${supplies.length} insumo${supplies.length !== 1 ? "s" : ""} en el catálogo`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvPanel<SupplyImportReport>
            fileNamePrefix="insumos"
            onImport={(file, dryRun, token) => api.supplies.importCsv(file, dryRun, token)}
            onExport={(token, delimiter) => api.supplies.exportCsv(token, delimiter)}
            onImported={handleImported}
          />
          <Link
            href="/dashboard/insumos/nuevo"
            className="flex items-center gap-2 bg-brand-blue text-white text-sm font-medium px-4 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
          >
            <Plus className="w-4 h-4" />
            Nuevo insumo
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {importReport && (
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            importReport.dry_run
              ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/20"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {importReport.dry_run && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/30">
                  Simulación — nada se guardó
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {importReport.rows_processed} filas procesadas
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
                {importReport.supplies_created} insumos creados
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200/80 dark:border-sky-500/20">
                {importReport.supplies_updated} insumos actualizados
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
                {importReport.variants_created} variantes creadas
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200/80 dark:border-sky-500/20">
                {importReport.variants_updated} variantes actualizadas
              </span>
              {importReport.errors.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
                  {importReport.errors.length} errores
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setImportReport(null)}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {importReport.errors.length > 0 && (
            <ul className="max-h-48 overflow-y-auto space-y-1 text-xs text-zinc-600 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800 pt-2">
              {importReport.errors.map((err, i) => (
                <li key={i}>
                  fila {err.row_number ?? "?"} · {err.identifier ?? "—"} — {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150"
        />
      </div>

      {/* Table (desktop) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
              <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Insumo
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Variantes
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Precio desde
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState search={search} />
                </td>
              </tr>
            ) : (
              filtered.map((supply) => {
                const stock = totalStock(supply);
                const price = lowestPrice(supply);
                return (
                  <tr
                    key={supply.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors duration-100 group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                          <Boxes className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-white truncate">
                            {supply.name}
                          </p>
                          {supply.description && (
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                              {supply.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {supply.variants.length}
                    </td>
                    <td className="px-4 py-4">
                      {stock === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
                          Sin stock
                        </span>
                      ) : (
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                          {stock} u.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {price !== null ? (
                        `$${price.toLocaleString("es-AR")}`
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500 text-xs">Sin precio</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          supply.is_active
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {supply.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <Link
                          href={`/dashboard/insumos/${supply.id}/editar`}
                          title="Editar"
                          className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors duration-150 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          title="Eliminar"
                          onClick={() => handleDelete(supply)}
                          className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          filtered.map((supply) => (
            <SupplyCard key={supply.id} supply={supply} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
