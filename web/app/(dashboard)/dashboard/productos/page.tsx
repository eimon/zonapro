"use client";

import { useEffect, useState } from "react";
import { api, type Product } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";

function totalStock(p: Product) {
  return p.variants.reduce((sum, v) => sum + v.stock_qty, 0);
}

function lowestPrice(p: Product): number | null {
  const prices = p.variants
    .filter((v) => v.price !== null)
    .map((v) => parseFloat(v.price!));
  return prices.length ? Math.min(...prices) : null;
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

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
        <Package className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {search ? "Sin resultados para tu búsqueda" : "No hay productos todavía"}
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
        {search ? "Probá con otro término" : "Creá el primer producto para empezar"}
      </p>
    </div>
  );
}

function ProductCard({
  product,
  onDelete,
}: {
  product: Product;
  onDelete: (product: Product) => void;
}) {
  const stock = totalStock(product);
  const price = lowestPrice(product);
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill sizes="40px" className="object-cover" />
          ) : (
            <Package className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-900 dark:text-white truncate">{product.name}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono truncate">{product.slug}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/dashboard/productos/${product.id}/editar`}
            title="Editar"
            className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-brand-green hover:bg-brand-green/10 transition-colors duration-150 cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </Link>
          <button
            title="Eliminar"
            onClick={() => onDelete(product)}
            className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-3.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
        <div>
          <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Variantes</p>
          <p className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">{product.variants.length}</p>
        </div>
        <div>
          <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Stock</p>
          {product.made_to_order ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20">
              A pedido
            </span>
          ) : stock === 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
              Sin stock
            </span>
          ) : (
            <p className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">{stock} u.</p>
          )}
        </div>
        <div>
          <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Precio desde</p>
          <p className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
            {product.made_to_order ? (
              <span className="text-zinc-400 dark:text-zinc-600 font-normal">—</span>
            ) : price !== null ? (
              `$${price.toLocaleString("es-AR")}`
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500 font-normal">Sin precio</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-zinc-400 dark:text-zinc-500 mb-0.5">Estado</p>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium border ${
              product.is_active
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            {product.is_active ? "Activo" : "Inactivo"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.products
      .list()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (product: Product) => {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    try {
      await api.products.remove(product.id, token);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar el producto");
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            Productos
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {loading
              ? "Cargando catálogo…"
              : `${products.length} producto${products.length !== 1 ? "s" : ""} en el catálogo`}
          </p>
        </div>
        <Link
          href="/dashboard/productos/nuevo"
          className="flex items-center gap-2 bg-brand-green text-zinc-950 text-sm font-medium px-4 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </Link>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nombre o slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-green/25 focus:border-brand-green transition-all duration-150"
        />
      </div>

      {/* Table (desktop) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
              <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Producto
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Variantes
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Precio desde
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
                <td colSpan={6}>
                  <EmptyState search={search} />
                </td>
              </tr>
            ) : (
              filtered.map((product) => {
                const stock = totalStock(product);
                const price = lowestPrice(product);
                return (
                  <tr
                    key={product.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors duration-100 group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-white truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono truncate">
                            {product.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {product.variants.length}
                    </td>
                    <td className="px-4 py-4">
                      {product.made_to_order ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20">
                          A pedido
                        </span>
                      ) : stock === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
                          Sin stock
                        </span>
                      ) : (
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                          {stock} u.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {product.made_to_order ? (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      ) : price !== null ? (
                        `$${price.toLocaleString("es-AR")}`
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500 text-xs">Sin precio</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          product.is_active
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {product.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <Link
                          href={`/dashboard/productos/${product.id}/editar`}
                          title="Editar"
                          className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-brand-green hover:bg-brand-green/10 transition-colors duration-150 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          title="Eliminar"
                          onClick={() => handleDelete(product)}
                          className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
          <EmptyState search={search} />
        ) : (
          filtered.map((product) => (
            <ProductCard key={product.id} product={product} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
