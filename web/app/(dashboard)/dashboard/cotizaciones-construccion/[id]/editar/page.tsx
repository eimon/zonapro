import { EditServiceQuotePage } from "@/components/service-quote-pages";

export default function EditarCotizacionConstruccionPage() {
  return (
    <EditServiceQuotePage
      quoteType="construccion"
      listHref="/dashboard/cotizaciones-construccion"
      typeLabel="construcción"
    />
  );
}
