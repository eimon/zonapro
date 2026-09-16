"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, ChevronDown, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Ingresá tu contraseña actual"),
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirmá tu nueva contraseña"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

function PasswordField({
  id,
  label,
  autoComplete,
  register,
  error,
}: {
  id: string;
  label: string;
  autoComplete: string;
  register: ReturnType<typeof useForm<FormData>>["register"];
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 pr-10 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors duration-150 focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/30"
          {...register(id as keyof FormData)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150 cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formId = useId();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), mode: "onBlur" });

  function toggleOpen() {
    if (open) {
      reset();
      setError(null);
      setSuccess(false);
    }
    setOpen((v) => !v);
  }

  const onSubmit = async (data: FormData) => {
    setError(null);
    const token = getToken();
    if (!token) return;

    try {
      await api.auth.changePassword(data.currentPassword, data.newPassword, token);
      reset();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña");
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={formId}
        className="flex w-full items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors duration-150"
      >
        <span className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4 text-brand-blue" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
            Cambiar contraseña
          </span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Actualizá la contraseña de tu cuenta
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <form
            id={formId}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 px-5 py-5"
          >
            <PasswordField
              id="currentPassword"
              label="Contraseña actual"
              autoComplete="current-password"
              register={register}
              error={errors.currentPassword?.message}
            />
            <PasswordField
              id="newPassword"
              label="Nueva contraseña"
              autoComplete="new-password"
              register={register}
              error={errors.newPassword?.message}
            />
            <PasswordField
              id="confirmPassword"
              label="Confirmar nueva contraseña"
              autoComplete="new-password"
              register={register}
              error={errors.confirmPassword?.message}
            />

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            {success && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Contraseña actualizada correctamente
              </p>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={toggleOpen}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
