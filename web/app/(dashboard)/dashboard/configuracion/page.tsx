"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { getRole, getToken } from "@/lib/auth";

const inputClass =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150";

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-brand-blue" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [resendMasked, setResendMasked] = useState<string | null>(null);
  const [resendInput, setResendInput] = useState("");
  const [resendSaving, setResendSaving] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getRole() !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([api.settings.getResendApiKey(token), api.settings.getRegistrationEnabled()])
      .then(([resend, registration]) => {
        setResendMasked(resend.is_set ? resend.masked : null);
        setRegistrationEnabled(registration.enabled);
        setAuthorized(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar la configuración"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSaveResendKey(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token || !resendInput) return;
    setResendSaving(true);
    setResendMessage(null);
    setError(null);
    try {
      const result = await api.settings.setResendApiKey(resendInput, token);
      setResendMasked(result.masked);
      setResendInput("");
      setResendMessage("Guardada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la API key");
    } finally {
      setResendSaving(false);
    }
  }

  async function handleToggleRegistration() {
    const token = getToken();
    if (!token) return;
    const next = !registrationEnabled;
    setRegistrationSaving(true);
    setError(null);
    try {
      const result = await api.settings.setRegistrationEnabled(next, token);
      setRegistrationEnabled(result.enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar la configuración");
    } finally {
      setRegistrationSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando configuración...</p>;
  }

  if (!authorized) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Configuración</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Preferencias generales del sistema.</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionCard
        icon={Mail}
        title="API key de Resend"
        description="Se usa para enviar los emails de invitación a nuevos usuarios."
      >
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Estado actual:{" "}
          {resendMasked ? (
            <span className="font-mono text-zinc-700 dark:text-zinc-300">{resendMasked}</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">no configurada</span>
          )}
        </p>
        <form onSubmit={handleSaveResendKey} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="password"
            value={resendInput}
            onChange={(e) => setResendInput(e.target.value)}
            placeholder="re_xxxxxxxxxxxxxxxx"
            className={`${inputClass} sm:flex-1`}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={resendSaving || !resendInput}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-[filter] duration-150 cursor-pointer whitespace-nowrap"
          >
            {resendSaving ? "Guardando..." : "Guardar"}
          </button>
        </form>
        {resendMessage && <p className="text-xs text-brand-blue">{resendMessage}</p>}
      </SectionCard>

      <SectionCard
        icon={ShieldCheck}
        title="Registro de usuarios"
        description="Permite que cualquier visitante cree su propia cuenta de cliente en la tienda."
      >
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Habilitar registro público de nuevos clientes
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={registrationEnabled}
            onClick={handleToggleRegistration}
            disabled={registrationSaving}
            className={`relative w-11 h-6 rounded-full transition-colors duration-150 shrink-0 disabled:opacity-50 cursor-pointer ${registrationEnabled ? "bg-brand-blue" : "bg-zinc-200 dark:bg-zinc-700"
              }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${registrationEnabled ? "translate-x-5" : "translate-x-0"
                }`}
            />
          </button>
        </label>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Los usuarios Vendedor y Administrador siempre se crean desde el panel de Usuarios,
          nunca por registro público.
        </p>
      </SectionCard>
    </div>
  );
}
