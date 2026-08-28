"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { api } from "@/lib/api";

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    if (!token) {
      setError("El enlace no es válido");
      return;
    }
    try {
      await api.auth.setPassword(token, data.password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "El enlace no es válido o expiró");
    }
  };

  if (!token) {
    return (
      <div className="w-full space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl text-center">
        <p className="text-sm text-red-500 dark:text-red-400">
          Este enlace no es válido. Pedile a un administrador que te reenvíe la invitación.
        </p>
        <Link href="/login" className="text-sm text-brand-blue hover:underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl text-center">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Contraseña creada con éxito
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Te llevamos a iniciar sesión…</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Creá tu contraseña</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Elegí una contraseña para poder ingresar al dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Confirmar contraseña
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
            {...register("confirm")}
          />
          {errors.confirm && (
            <p className="text-xs text-red-500 dark:text-red-400">{errors.confirm.message}</p>
          )}
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Guardando..." : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
