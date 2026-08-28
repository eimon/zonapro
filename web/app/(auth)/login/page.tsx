"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { getRole, setToken } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await api.auth.login(data.email, data.password);
      setToken(res.access_token);
      const role = getRole();
      if (role === "ADMIN" || role === "VENDEDOR") {
        router.push("/dashboard");
      } else {
        router.push("/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar sesión");
    }
  };

  return (
    <div className="w-full space-y-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Iniciar sesión</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingresá con tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
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
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-medium text-brand-blue hover:underline">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
