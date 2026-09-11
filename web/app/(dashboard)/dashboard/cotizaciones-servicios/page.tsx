import { QuotesList } from "@/components/quotes-list";

export default function CotizacionesServiciosPage() {
  return (
    <QuotesList
      quoteType="servicios"
      title="Cotizar Servicios"
      newHref="/dashboard/cotizaciones-servicios/nueva"
      newLabel="+ Nueva cotización de servicios"
      editHrefBase="/dashboard/cotizaciones-servicios"
    />
  );
}
