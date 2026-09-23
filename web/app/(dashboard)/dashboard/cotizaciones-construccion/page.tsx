import { QuotesList } from "@/components/quotes-list";

export default function CotizacionesConstruccionPage() {
  return (
    <QuotesList
      quoteType="construccion"
      title="Cotizar Construcción"
      newHref="/dashboard/cotizaciones-construccion/nueva"
      newLabel="+ Nueva cotización de construcción"
      editHrefBase="/dashboard/cotizaciones-construccion"
    />
  );
}
