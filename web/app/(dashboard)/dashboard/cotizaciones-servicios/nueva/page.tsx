import { NewServiceQuotePage } from "@/components/service-quote-pages";

export default function NuevaCotizacionServiciosPage() {
  return (
    <NewServiceQuotePage
      quoteType="servicios"
      listHref="/dashboard/cotizaciones-servicios"
      typeLabel="servicios"
    />
  );
}
