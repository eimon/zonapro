import { z } from "zod";

// Pure move: shared between the productos (Cotizaciones) and servicios
// (Cotizar Servicios) creation/edit pages. Identical to the schema
// previously duplicated in cotizaciones/nueva/page.tsx and
// cotizaciones/[id]/editar/page.tsx — no field, validation rule, or
// default changed.
export const quoteFormSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  client_name: z.string().min(1, "El nombre del cliente es obligatorio"),
  client_email: z.string().email("Email inválido"),
  client_phone: z.string().optional(),
  validity_days: z.number().int().min(1, "Mínimo 1 día"),
  notes: z.string().optional(),
  cost_notes: z.string().optional(),
  margin_notes: z.string().optional(),
  internal_comments: z.string().optional(),
  contempla_iva: z.boolean(),
});

export type QuoteFormValues = z.infer<typeof quoteFormSchema>;
