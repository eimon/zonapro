import { NewServiceQuotePage } from "@/components/service-quote-pages";

export default function NuevaCotizacionConstruccionPage() {
  return (
    <NewServiceQuotePage
      quoteType="construccion"
      listHref="/dashboard/cotizaciones-construccion"
      typeLabel="construcción"
    />
  );
}
