"use client";

import { CsvPanel } from "@/components/csv-panel";
import { api, type ImportReport } from "@/lib/api";

export function ProductCsvPanel({ onImported }: { onImported: (report: ImportReport) => void }) {
  return (
    <CsvPanel<ImportReport>
      helpHref="/dashboard/productos/ayuda-csv"
      fileNamePrefix="catalogo"
      onImport={(file, dryRun, token) => api.products.importCsv(file, dryRun, token)}
      onExport={(token, delimiter) => api.products.exportCsv(token, delimiter)}
      onImported={onImported}
    />
  );
}
