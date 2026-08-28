"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

const schema = z
  .object({
    nombre: z.string().min(1, "El nombre es requerido"),
    apellido: z.string().min(1, "El apellido es requerido"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirmá tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function RegistroPage() {
  const router = useRouter();
  const [checkingAvailability, setCheckingAvailability] = useState(true);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    api.settings
      .getRegistrationEnabled()
      .then((res) => setAvailable(res.enabled))
      .catch(() => setAvailable(false))
      .finally(() => setCheckingAvailability(false));
  }, []);

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await api.auth.register({
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        password: data.password,
      });
      setToken(res.access_token);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear la cuenta");
    }
  };

  if (checkingAvailability) {
    return (
      <div className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando...</p>
      </div>
    );
  }

  if (!available) {
    return (
      <div className="w-full space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl text-center">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Registro no disponible</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Por el momento no se pueden crear cuentas nuevas. Si ya tenés una cuenta, iniciá sesión.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-brand-blue hover:underline"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Crear cuenta</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Registrate para comprar y pedir cotizaciones</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="nombre" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nombre
            </label>
            <input
              id="nombre"
              autoComplete="given-name"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
              {...register("nombre")}
            />
            {errors.nombre && (
              <p className="text-xs text-red-500 dark:text-red-400">{errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="apellido" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Apellido
            </label>
            <input
              id="apellido"
              autoComplete="family-name"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
              {...register("apellido")}
            />
            {errors.apellido && (
              <p className="text-xs text-red-500 dark:text-red-400">{errors.apellido.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500 dark:text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-brand-blue hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
