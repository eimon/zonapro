"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type UserMe } from "@/lib/api";
import { getRole, getToken } from "@/lib/auth";
import { Plus, RotateCcw, Search, Send, Shield, Trash2, UserRound } from "lucide-react";

type View = "active" | "deleted";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  cliente: "Cliente",
};

function SkeletonRow() {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>
      </td>
      {[...Array(2)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3.5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </td>
      ))}
      <td className="px-6 py-4" />
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ search, view }: { search: string; view: View }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
        <UserRound className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {search
          ? "Sin resultados para tu búsqueda"
          : view === "deleted"
            ? "No hay usuarios eliminados"
            : "No hay usuarios todavía"}
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
        {search
          ? "Probá con otro término"
          : view === "deleted"
            ? "Los usuarios que elimines aparecerán acá"
            : "Creá el primer usuario para empezar"}
      </p>
    </div>
  );
}

const RESEND_BUTTON_CLASS =
  "p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const RESTORE_BUTTON_CLASS =
  "p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

function StatusBadge({ user, deleted }: { user: UserMe; deleted: boolean }) {
  if (deleted) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
        Eliminado
      </span>
    );
  }
  if (!user.is_active) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
        Inactivo
      </span>
    );
  }
  if (user.must_change_password) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20">
        Invitación pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
      Activo
    </span>
  );
}

function UserCard({
  user,
  deleted,
  onDelete,
  onResend,
  onRestore,
  resending,
  restoring,
}: {
  user: UserMe;
  deleted: boolean;
  onDelete: (id: string) => void;
  onResend: (id: string) => void;
  onRestore: (id: string) => void;
  resending: boolean;
  restoring: boolean;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
          {user.role === "admin" ? (
            <Shield className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          ) : (
            <UserRound className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-900 dark:text-white truncate">
            {user.nombre} {user.apellido}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{user.email}</p>
        </div>
        {deleted ? (
          <button
            title="Restaurar"
            onClick={() => onRestore(user.id)}
            disabled={restoring}
            className={`${RESTORE_BUTTON_CLASS} shrink-0`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : (
          <>
            {user.is_active && user.must_change_password && (
              <button
                title="Reenviar invitación"
                onClick={() => onResend(user.id)}
                disabled={resending}
                className={`${RESEND_BUTTON_CLASS} shrink-0`}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
            <button
              title="Eliminar"
              onClick={() => onDelete(user.id)}
              className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <div className="mt-3.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          {ROLE_LABELS[user.role] ?? user.role}
        </span>
        <StatusBadge user={user} deleted={deleted} />
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserMe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [view, setView] = useState<View>("active");
  const isDeletedView = view === "deleted";

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
    // Evita que una respuesta tardía de la vista anterior pise la actual.
    let cancelled = false;
    const fetchUsers = view === "deleted" ? api.users.listDeleted : api.users.list;
    fetchUsers(token)
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, view]);

  const changeView = (next: View) => {
    if (next === view) return;
    setError(null);
    setNotice(null);
    setUsers([]);
    setLoading(true);
    setView(next);
  };

  const handleDelete = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setError(null);
    setNotice(null);
    try {
      await api.users.remove(id, token);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar el usuario");
    }
  };

  const handleResend = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setError(null);
    setNotice(null);
    setResendingId(id);
    try {
      await api.users.resendInvite(id, token);
      setNotice("Invitación reenviada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al reenviar la invitación");
    } finally {
      setResendingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setError(null);
    setNotice(null);
    setRestoringId(id);
    try {
      await api.users.restore(id, token);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setNotice("Usuario restaurado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al restaurar el usuario");
    } finally {
      setRestoringId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      `${u.nombre} ${u.apellido}`.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            Gestión de usuarios
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {loading
              ? "Cargando usuarios…"
              : `${users.length} usuario${users.length !== 1 ? "s" : ""} ${isDeletedView ? "eliminado" : "registrado"}${users.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/dashboard/usuarios/nuevo"
          className="flex items-center gap-2 bg-brand-blue text-white text-sm font-medium px-4 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </Link>
      </div>

      {/* Search + view toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150"
          />
        </div>
        <div
          role="group"
          aria-label="Filtrar usuarios"
          className="inline-flex self-start p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
        >
          {(
            [
              ["active", "Activos"],
              ["deleted", "Eliminados"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => changeView(value)}
              aria-pressed={view === value}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer ${
                view === value
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

      {/* Table (desktop) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
              <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState search={search} view={view} />
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors duration-100 group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        {user.role === "admin" ? (
                          <Shield className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        ) : (
                          <UserRound className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-white truncate">
                          {user.nombre} {user.apellido}
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge user={user} deleted={isDeletedView} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {isDeletedView ? (
                        <button
                          title="Restaurar"
                          onClick={() => handleRestore(user.id)}
                          disabled={restoringId === user.id}
                          className={RESTORE_BUTTON_CLASS}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          {user.is_active && user.must_change_password && (
                            <button
                              title="Reenviar invitación"
                              onClick={() => handleResend(user.id)}
                              disabled={resendingId === user.id}
                              className={RESEND_BUTTON_CLASS}
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            title="Eliminar"
                            onClick={() => handleDelete(user.id)}
                            className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState search={search} view={view} />
        ) : (
          filtered.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              deleted={isDeletedView}
              onDelete={handleDelete}
              onResend={handleResend}
              onRestore={handleRestore}
              resending={resendingId === user.id}
              restoring={restoringId === user.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
