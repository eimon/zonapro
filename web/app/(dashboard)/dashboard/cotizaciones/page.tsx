import { QuotesList } from "@/components/quotes-list";

export default function CotizacionesPage() {
  return (
    <QuotesList
      quoteType="productos"
      title="Cotizaciones"
      newHref="/dashboard/cotizaciones/nueva"
      newLabel="+ Nueva cotización"
      editHrefBase="/dashboard/cotizaciones"
    />
  );
}
