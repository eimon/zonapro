"use client";

import { useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { api, type ImportReport } from "@/lib/api";
import { getToken } from "@/lib/auth";

export function ProductCsvPanel({ onImported }: { onImported: (report: ImportReport) => void }) {
  const [dryRun, setDryRun] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const token = getToken();
    if (!token) return;
    setImporting(true);
    setError(null);
    try {
      const report = await api.products.importCsv(file, dryRun, token);
      onImported(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar el CSV");
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    const token = getToken();
    if (!token) return;
    setExporting(true);
    setError(null);
    try {
      const url = await api.products.exportCsv(token);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalogo-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar el catálogo");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        {exporting ? "Exportando..." : "Exportar CSV"}
      </button>

      <label
        className={`flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer ${
          importing ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <Upload className="w-4 h-4" />
        {importing ? "Importando..." : "Importar CSV"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
          disabled={importing}
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 select-none">
        <input
          type="checkbox"
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
          className="rounded border-zinc-300 dark:border-zinc-700 text-brand-green focus:ring-brand-green/25"
        />
        Simulación (no guarda)
      </label>

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
          {error}
          <button type="button" onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </p>
      )}
    </div>
  );
}
