"use client";

import { useEffect, useState } from "react";
import { api, type Package } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Link from "next/link";
import { AlertTriangle, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PackageImageMosaic } from "@/components/package-image-mosaic";

function money(value: string) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
      {[...Array(4)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3.5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </td>
      ))}
      <td className="px-6 py-4" />
    </tr>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
        <Layers className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {search ? "Sin resultados para tu búsqueda" : "No hay paquetes todavía"}
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
        {search ? "Probá con otro término" : "Creá el primer paquete promocional para empezar"}
      </p>
    </div>
  );
}

function StatusBadges({ pkg }: { pkg: Package }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
          pkg.is_active
            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
        }`}
      >
        {pkg.is_active ? "Activo" : "Inactivo"}
      </span>
      {pkg.is_active && !pkg.is_available && (
        <span
          title="Al menos un producto o insumo del paquete está inactivo o fue eliminado"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20"
        >
          <AlertTriangle className="w-3 h-3" />
          No disponible
        </span>
      )}
    </div>
  );
}

export default function PaquetesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadPackages = () => {
    const token = getToken();
    if (!token) return Promise.resolve();
    return api.packages.listAdmin(token).then(setPackages).catch(() => {});
  };

  useEffect(() => {
    loadPackages().finally(() => setLoading(false));
  }, []);

  const handleDelete = async (pkg: Package) => {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`¿Eliminar "${pkg.name}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    try {
      await api.packages.remove(pkg.id, token);
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar el paquete");
    }
  };

  const filtered = packages.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">Paquetes</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {loading ? "Cargando paquetes…" : `${packages.length} paquete${packages.length !== 1 ? "s" : ""} creados`}
          </p>
        </div>
        <Link
          href="/dashboard/paquetes/nuevo"
          className="flex items-center gap-2 bg-brand-blue text-white text-sm font-medium px-4 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
        >
          <Plus className="w-4 h-4" />
          Nuevo paquete
        </Link>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150"
        />
      </div>

      {/* Table (desktop) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
              <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Paquete</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ítems</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Precio de lista</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Precio final</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Descuento</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Estado</th>
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
                <td colSpan={7}>
                  <EmptyState search={search} />
                </td>
              </tr>
            ) : (
              filtered.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors duration-100 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden">
                        <PackageImageMosaic
                          images={pkg.items.map((item) => item.image_url)}
                          alt={pkg.name}
                          sizes="36px"
                          iconClassName="w-4 h-4 text-zinc-400 dark:text-zinc-500"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-white truncate">{pkg.name}</p>
                        {pkg.description && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-xs">{pkg.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300 tabular-nums">{pkg.items.length}</td>
                  <td className="px-4 py-4 text-zinc-500 dark:text-zinc-500 tabular-nums line-through">
                    {money(pkg.list_price)}
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    <span className="block font-medium text-zinc-900 dark:text-white">{money(pkg.final_price)}</span>
                    <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      Sin impuestos: {money(pkg.final_price_net)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">
                    -{parseFloat(pkg.discount_percent).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadges pkg={pkg} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <Link
                        href={`/dashboard/paquetes/${pkg.id}/editar`}
                        title="Editar"
                        className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors duration-150 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        title="Eliminar"
                        onClick={() => handleDelete(pkg)}
                        className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando paquetes…</p>
        ) : filtered.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          filtered.map((pkg) => (
            <div key={pkg.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="relative w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden">
                  <PackageImageMosaic
                    images={pkg.items.map((item) => item.image_url)}
                    alt={pkg.name}
                    sizes="40px"
                    iconClassName="w-4 h-4 text-zinc-400 dark:text-zinc-500"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{pkg.name}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">{pkg.items.length} ítems</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/dashboard/paquetes/${pkg.id}/editar`}
                    title="Editar"
                    className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors duration-150 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    title="Eliminar"
                    onClick={() => handleDelete(pkg)}
                    className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
                <div>
                  <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Precio de lista</p>
                  <p className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums line-through">{money(pkg.list_price)}</p>
                </div>
                <div>
                  <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Precio final</p>
                  <p className="font-medium text-zinc-900 dark:text-white tabular-nums">{money(pkg.final_price)}</p>
                  <p className="text-zinc-400 dark:text-zinc-500 tabular-nums">
                    Sin impuestos: {money(pkg.final_price_net)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Descuento</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                    -{parseFloat(pkg.discount_percent).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Estado</p>
                  <StatusBadges pkg={pkg} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
