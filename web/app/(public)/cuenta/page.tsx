"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon } from "lucide-react";
import { api, type UserMe } from "@/lib/api";
import { getToken } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  cliente: "Cliente",
};

export default function CuentaPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api.auth
      .me(token)
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-sm text-zinc-500">Cargando cuenta…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="flex items-center gap-4 mb-8">
        <span className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shrink-0">
          <UserIcon className="w-6 h-6 text-zinc-500 dark:text-zinc-300" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            {user.nombre} {user.apellido}
          </h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 divide-y divide-zinc-200 dark:divide-zinc-800">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-zinc-500">Nombre</span>
          <span className="text-sm text-zinc-700 dark:text-zinc-200">
            {user.nombre} {user.apellido}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-zinc-500">Email</span>
          <span className="text-sm text-zinc-700 dark:text-zinc-200">{user.email}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-zinc-500">Rol</span>
          <span className="text-sm text-zinc-700 dark:text-zinc-200">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-zinc-500">Estado</span>
          <span
            className={`text-sm ${user.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}
          >
            {user.is_active ? "Activa" : "Inactiva"}
          </span>
        </div>
      </div>
    </div>
  );
}
