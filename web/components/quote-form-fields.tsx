import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { QuoteFormValues } from "@/lib/quote-form";

// Pure move: identical JSX/Tailwind classes previously duplicated across
// cotizaciones/nueva/page.tsx and cotizaciones/[id]/editar/page.tsx.
// No markup, copy, or field order changed.
//
// NOTE: the two source pages differ in exactly one respect — `nueva`
// renders placeholders on every input/textarea, `editar` renders none.
// That pre-existing difference is preserved via the `placeholders` prop
// (default true, matching `nueva`) rather than silently unified, so this
// extraction is behavior-preserving for both call sites.

type QuoteFormFieldsProps = {
  register: UseFormRegister<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  placeholders?: boolean;
};

export function QuoteClientFields({ register, errors, placeholders = true }: QuoteFormFieldsProps) {
  return (
    <>
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Título <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          {...register("title")}
          className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          placeholder={placeholders ? "Ej. Sistema domótico residencial" : undefined}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.title.message}</p>
        )}
      </div>

      {/* Client name */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Nombre del cliente <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          {...register("client_name")}
          className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          placeholder={placeholders ? "Juan García" : undefined}
        />
        {errors.client_name && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.client_name.message}</p>
        )}
      </div>

      {/* Client email + phone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Email <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            {...register("client_email")}
            type="email"
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder={placeholders ? "juan@email.com" : undefined}
          />
          {errors.client_email && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.client_email.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Teléfono
          </label>
          <input
            {...register("client_phone")}
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder={placeholders ? "+54 9 11 1234-5678" : undefined}
          />
        </div>
      </div>

      {/* Validity */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Días de validez
        </label>
        <input
          {...register("validity_days", { valueAsNumber: true })}
          type="number"
          min={1}
          className="block w-32 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        {errors.validity_days && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.validity_days.message}</p>
        )}
      </div>

      {/* IVA */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer group w-fit">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-brand-blue"
            {...register("contempla_iva")}
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            Incluir IVA en esta cotización
          </span>
        </label>
      </div>

      {/* Notes (visible to client) */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Notas para el cliente
        </label>
        <textarea
          {...register("notes")}
          rows={3}
          className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          placeholder={placeholders ? "Condiciones de pago, plazos, garantías..." : undefined}
        />
      </div>
    </>
  );
}

export function QuoteInternalFields({
  register,
  placeholders = true,
}: Pick<QuoteFormFieldsProps, "register" | "placeholders">) {
  return (
    <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-4">
        Campos internos (no visibles para el cliente)
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Notas de costos
          </label>
          <textarea
            {...register("cost_notes")}
            rows={2}
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder={placeholders ? "Desglose de costos internos..." : undefined}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Notas de margen
          </label>
          <textarea
            {...register("margin_notes")}
            rows={2}
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder={placeholders ? "Margen aplicado, descuentos, etc..." : undefined}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Comentarios internos
          </label>
          <textarea
            {...register("internal_comments")}
            rows={2}
            className="block w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder={placeholders ? "Notas del equipo..." : undefined}
          />
        </div>
      </div>
    </div>
  );
}
