"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { CatalogFacets, CatalogSort } from "@/lib/api";
import { activeFilterCount, buildStoreQuery, toggleValue, type StoreFilters } from "@/lib/store-filters";

const SORT_LABELS: Record<CatalogSort, string> = {
  featured: "Destacados",
  price_asc: "Menor precio",
  price_desc: "Mayor precio",
};

type Chip = { key: string; label: string; onRemove: () => void };

function useStoreNavigation(filters: StoreFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function go(next: Partial<StoreFilters>) {
    const merged: StoreFilters = { ...filters, page: 1, ...next };
    startTransition(() => {
      router.replace(`${pathname}${buildStoreQuery(merged)}`, { scroll: false });
    });
  }

  return { go, isPending };
}

function CheckboxRow({
  label,
  count,
  checked,
  disabled,
  onChange,
  rowHeight = "min-h-9",
}: {
  label: string;
  count: number;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  rowHeight?: string;
}) {
  return (
    <label
      className={`group flex items-center gap-2.5 ${rowHeight} cursor-pointer ${disabled ? "opacity-45" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="w-4 h-4 accent-brand-blue shrink-0"
      />
      <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">
        {label}
      </span>
      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-500">{count}</span>
    </label>
  );
}

function FilterFieldsets({
  facets,
  filters,
  go,
  rowHeight,
}: {
  facets: CatalogFacets;
  filters: StoreFilters;
  go: (next: Partial<StoreFilters>) => void;
  rowHeight?: string;
}) {
  return (
    <>
      {facets.categories.length > 0 && (
        <fieldset className="border-0 m-0 p-0 flex flex-col gap-0.5">
          <legend className="pb-2.5 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
            Categoría
          </legend>
          {facets.categories.map((c) => {
            const checked = filters.category.includes(c.slug);
            return (
              <CheckboxRow
                key={c.slug}
                label={c.name}
                count={c.count}
                checked={checked}
                disabled={!checked && c.count === 0}
                rowHeight={rowHeight}
                onChange={() => go({ category: toggleValue(filters.category, c.slug) })}
              />
            );
          })}
        </fieldset>
      )}

      {facets.availability.length > 0 && (
        <fieldset className="border-0 m-0 p-0 flex flex-col gap-0.5">
          <legend className="pb-2.5 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
            Disponibilidad
          </legend>
          {facets.availability.map((a) => {
            const checked = filters.availability.includes(a.id);
            return (
              <CheckboxRow
                key={a.id}
                label={a.label}
                count={a.count}
                checked={checked}
                disabled={!checked && a.count === 0}
                rowHeight={rowHeight}
                onChange={() => go({ availability: toggleValue(filters.availability, a.id) })}
              />
            );
          })}
        </fieldset>
      )}

      <fieldset className="border-0 m-0 p-0 flex flex-col gap-0.5">
        <legend className="pb-2.5 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
          Precio
        </legend>
        {facets.price.map((p) => {
          const checked = filters.price.includes(p.id);
          return (
            <CheckboxRow
              key={p.id}
              label={p.label}
              count={p.count}
              checked={checked}
              disabled={!checked && p.count === 0}
              rowHeight={rowHeight}
              onChange={() => go({ price: toggleValue(filters.price, p.id) })}
            />
          );
        })}
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
          Rangos calculados sobre los precios del catálogo actual.
        </p>
      </fieldset>
    </>
  );
}

function buildChips(filters: StoreFilters, facets: CatalogFacets, go: (n: Partial<StoreFilters>) => void): Chip[] {
  const chips: Chip[] = [];
  for (const slug of filters.category) {
    const name = facets.categories.find((c) => c.slug === slug)?.name ?? slug;
    chips.push({ key: `cat-${slug}`, label: name, onRemove: () => go({ category: toggleValue(filters.category, slug) }) });
  }
  for (const id of filters.availability) {
    const label = facets.availability.find((a) => a.id === id)?.label ?? id;
    chips.push({ key: `av-${id}`, label, onRemove: () => go({ availability: toggleValue(filters.availability, id) }) });
  }
  for (const id of filters.price) {
    const label = facets.price.find((p) => p.id === id)?.label ?? id;
    chips.push({ key: `pr-${id}`, label, onRemove: () => go({ price: toggleValue(filters.price, id) }) });
  }
  if (filters.q) {
    chips.push({ key: "q", label: `"${filters.q}"`, onRemove: () => go({ q: "" }) });
  }
  return chips;
}

function MobileFilterSheet({
  open,
  onClose,
  facets,
  filters,
  go,
  total,
}: {
  open: boolean;
  onClose: () => void;
  facets: CatalogFacets;
  filters: StoreFilters;
  go: (next: Partial<StoreFilters>) => void;
  total: number;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-zinc-900/45" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
        className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl flex flex-col"
      >
        <div className="flex justify-center pt-2.5">
          <span className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>
        <div className="flex items-center justify-between pl-5 pr-2 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <h2 id="filter-sheet-title" className="text-[17px] font-semibold text-zinc-900 dark:text-white">
            Filtros
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar filtros"
            className="w-11 h-11 flex items-center justify-center text-zinc-600 dark:text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
          <FilterFieldsets facets={facets} filters={filters} go={go} rowHeight="min-h-12" />
        </div>

        <div className="flex gap-2.5 px-4 pt-3.5 pb-6 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => go({ category: [], availability: [], price: [] })}
            className="h-12 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 text-[15px] font-medium text-zinc-900 dark:text-white"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-brand-blue text-white text-[15px] font-semibold"
          >
            Ver {total} producto{total !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StoreShell({
  facets,
  filters,
  total,
  children,
}: {
  facets: CatalogFacets;
  filters: StoreFilters;
  total: number;
  children: React.ReactNode;
}) {
  const { go, isPending } = useStoreNavigation(filters);
  const [qDraft, setQDraft] = useState(filters.q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the search box in sync when filters.q changes from elsewhere (chip
  // removal, "Limpiar todo", back/forward navigation) — adjusted during
  // render rather than in an effect, per React's guidance for deriving state
  // from props (avoids an extra render pass).
  const [lastSyncedQ, setLastSyncedQ] = useState(filters.q);
  if (filters.q !== lastSyncedQ) {
    setLastSyncedQ(filters.q);
    setQDraft(filters.q);
  }

  function onSearchChange(value: string) {
    setQDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => go({ q: value }), 400);
  }

  const chips = buildChips(filters, facets, go);
  const filterCount = activeFilterCount(filters);

  return (
    <div className="flex flex-col gap-6">
      {/* Search + sort row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        <label className="relative flex items-center">
          <span className="sr-only">Buscar productos</span>
          <Search className="absolute left-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por nombre"
            value={qDraft}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full sm:w-[280px] h-11 pl-10 pr-3.5 rounded-[10px] border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400"
          />
        </label>
        <label className="hidden sm:flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Ordenar
          <select
            value={filters.sort}
            onChange={(e) => go({ sort: e.target.value as CatalogSort })}
            className="h-11 px-3 rounded-[10px] border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Mobile filter/sort bar */}
      <div className="lg:hidden flex gap-2">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex-1 h-11 rounded-[10px] border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-900 dark:text-white flex items-center justify-center gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {filterCount > 0 && (
            <span className="min-w-5 h-5 px-1 rounded-full bg-brand-blue text-white text-xs flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
        <select
          value={filters.sort}
          onChange={(e) => go({ sort: e.target.value as CatalogSort })}
          aria-label="Ordenar"
          className="flex-1 h-11 rounded-[10px] border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-900 dark:text-white text-center"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-10 items-start">
        {/* Desktop sidebar */}
        <aside aria-label="Filtros" className="hidden lg:flex w-[240px] shrink-0 flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Filtros</h2>
            {filterCount > 0 && (
              <button
                type="button"
                onClick={() => go({ category: [], availability: [], price: [] })}
                className="text-[13px] font-medium text-brand-blue hover:opacity-80 transition-opacity px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Limpiar todo
              </button>
            )}
          </div>
          <FilterFieldsets facets={facets} filters={filters} go={go} />
        </aside>

        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 min-h-9">
            <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
              <strong className="text-zinc-900 dark:text-white">
                {total} producto{total !== 1 ? "s" : ""}
              </strong>
            </p>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`Quitar filtro ${chip.label}`}
                    className="flex items-center gap-1.5 h-8 pl-3 pr-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[13px] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {chip.label}
                    <X className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`transition-opacity duration-150 ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
            {children}
          </div>
        </div>
      </div>

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        facets={facets}
        filters={filters}
        go={go}
        total={total}
      />
    </div>
  );
}
