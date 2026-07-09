"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { api, ConsultationCreate, ConsultationPublicResponse, ConsultationType } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function ConsultaForm() {
  const searchParams = useSearchParams();
  const packageId = searchParams.get("package_id") ?? undefined;
  const productId = searchParams.get("product_id") ?? undefined;

  const [submitted, setSubmitted] = useState<ConsultationPublicResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const getType = (): ConsultationType => {
    if (packageId) return "package";
    if (productId) return "product";
    return "free_form";
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const payload: ConsultationCreate = {
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      message: values.message || undefined,
      type: getType(),
      package_id: packageId,
      product_id: productId,
    };

    try {
      const result = await api.consultations.create(payload);
      setSubmitted(result);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Error al enviar la consulta");
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <div className="text-brand-green text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-white">¡Consulta enviada!</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Tu número de consulta es:{" "}
          <span className="font-mono font-medium text-zinc-900 dark:text-white">
            {submitted.id.slice(0, 8).toUpperCase()}
          </span>
        </p>
        <p className="text-sm text-zinc-500">Nos pondremos en contacto con vos a la brevedad.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-white">Consulta</h1>
      {packageId && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Consulta sobre paquete seleccionado</p>
      )}
      {productId && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Consulta sobre producto seleccionado</p>
      )}
      {!packageId && !productId && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Envianos tu consulta y te respondemos a la brevedad
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
            Nombre <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            {...register("name")}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green"
            placeholder="Tu nombre"
          />
          {errors.name && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
            Email <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            {...register("email")}
            type="email"
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green"
            placeholder="tu@email.com"
          />
          {errors.email && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Teléfono</label>
          <input
            {...register("phone")}
            type="tel"
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green"
            placeholder="+54 11 1234-5678"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Mensaje</label>
          <textarea
            {...register("message")}
            rows={4}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green resize-none"
            placeholder="Contanos tu consulta..."
          />
        </div>

        {serverError && <p className="text-sm text-red-500 dark:text-red-400">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand-green text-zinc-950 font-semibold py-3 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-60"
        >
          {isSubmitting ? "Enviando..." : "Enviar consulta"}
        </button>
      </form>
    </div>
  );
}

export default function ConsultaPage() {
  return (
    <Suspense>
      <ConsultaForm />
    </Suspense>
  );
}
