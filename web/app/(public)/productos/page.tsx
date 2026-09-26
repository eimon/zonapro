import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { api } from "@/lib/api";
import { parseStoreFilters, buildStoreQuery } from "@/lib/store-filters";
import { StoreShell } from "@/components/store/store-shell";
import { ProductCard } from "@/components/store/product-card";
import { PromoPackages } from "@/components/store/promo-packages";

// Filtering/sorting/pagination is entirely server-driven from searchParams —
// there's nothing here that's safe to cache across requests.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters = parseStoreFilters(sp);

  const [catalog, packages] = await Promise.all([
    api.products.catalog({ ...filters, page_size: PAGE_SIZE }),
    api.packages.list(),
  ]);

  // Promo section visibility: show when no category filter is active, or
  // when at least one selected category contains a product from the package.
  const activeCategorySet = new Set(filters.category);
  const visiblePackages =
    activeCategorySet.size === 0
      ? packages
      : packages.filter((pkg) => pkg.items.some((item) => item.category_slug && activeCategorySet.has(item.category_slug)));

  const totalPages = Math.max(1, Math.ceil(catalog.total / PAGE_SIZE));
  const hasActiveFilters = filters.category.length + filters.availability.length + filters.price.length > 0 || !!filters.q;

  return (
    <div className="px-6 py-9 lg:px-16">
      <div className="max-w-[1312px] mx-auto flex flex-col gap-5">
        <nav aria-label="Ruta" className="flex gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-zinc-900 dark:text-white">Tienda</span>
        </nav>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">Tienda</h1>
          <p className="text-[15px] text-zinc-600 dark:text-zinc-400">
            Equipos para energía solar, climatización y domótica. Precios finales con IVA.
          </p>
        </div>

        <StoreShell facets={catalog.facets} filters={filters} total={catalog.total}>
          <div className="flex flex-col gap-8">
            {visiblePackages.length > 0 && <PromoPackages packages={visiblePackages} />}

            {catalog.items.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none m-0 p-0">
                {catalog.items.map((item) => (
                  <li key={item.id}>
                    <ProductCard item={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl px-8 py-16 flex flex-col items-center gap-3 text-center">
                <SearchIcon className="w-8 h-8 text-zinc-400 dark:text-zinc-600" strokeWidth={1.5} />
                <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">
                  No hay productos con estos filtros
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Probá quitando algún filtro o buscando otro término.
                </p>
                {hasActiveFilters && (
                  <Link
                    href="/productos"
                    className="mt-2 h-11 px-[18px] rounded-[10px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium flex items-center"
                  >
                    Limpiar filtros
                  </Link>
                )}
              </div>
            )}

            {totalPages > 1 && (
              <nav aria-label="Paginación" className="flex items-center justify-center gap-2 pt-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const isCurrent = pageNum === filters.page;
                  return (
                    <Link
                      key={pageNum}
                      href={`/productos${buildStoreQuery({ ...filters, page: pageNum })}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        isCurrent
                          ? "bg-brand-blue text-white"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </StoreShell>
      </div>
    </div>
  );
}
