import { EditServiceQuotePage } from "@/components/service-quote-pages";

export default function EditarCotizacionServiciosPage() {
  return (
    <EditServiceQuotePage
      quoteType="servicios"
      listHref="/dashboard/cotizaciones-servicios"
      typeLabel="servicios"
    />
  );
}
