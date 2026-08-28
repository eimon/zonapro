"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { api } from "@/lib/api";
import { getRole, getToken } from "@/lib/auth";
import { ArrowLeft, Mail } from "lucide-react";

const schema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().min(1, "Apellido requerido"),
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "vendedor"]),
});

type FormData = z.infer<typeof schema>;

function InputField({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150";

export default function NuevoUsuarioPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "vendedor" },
  });

  useEffect(() => {
    if (getRole() !== "ADMIN") router.replace("/dashboard");
  }, [router]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const user = await api.users.create(data, token);
      setSent(user.email);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error al crear el usuario");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/usuarios"
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
          aria-label="Volver a usuarios"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            Nuevo usuario
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Le enviamos un email para que defina su contraseña
          </p>
        </div>
      </div>

      {sent ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            Invitación enviada a {sent}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            El usuario recibirá un correo con un enlace para crear su contraseña e ingresar al dashboard.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Link
              href="/dashboard/usuarios"
              className="px-4 py-2 text-sm font-medium bg-brand-blue text-white rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
            >
              Volver a usuarios
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InputField label="Nombre" required error={errors.nombre?.message}>
                <input
                  type="text"
                  placeholder="Ej: Juana"
                  className={inputClass}
                  {...register("nombre")}
                />
              </InputField>

              <InputField label="Apellido" required error={errors.apellido?.message}>
                <input
                  type="text"
                  placeholder="Ej: Pérez"
                  className={inputClass}
                  {...register("apellido")}
                />
              </InputField>
            </div>

            <InputField label="Email" required error={errors.email?.message}>
              <input
                type="email"
                placeholder="juana@zonapro.com.ar"
                className={inputClass}
                {...register("email")}
              />
            </InputField>

            <InputField label="Rol" required error={errors.role?.message}>
              <select className={inputClass} {...register("role")}>
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </InputField>
          </div>

          {serverError && (
            <p className="text-sm text-red-500 dark:text-red-400 text-center">{serverError}</p>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link
              href="/dashboard/usuarios"
              className="px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-brand-blue text-white text-sm font-medium px-6 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Enviando..." : "Crear e invitar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
