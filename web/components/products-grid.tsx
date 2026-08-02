"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageSquare, Package, Tag } from "lucide-react";
import type { Category, Product } from "@/lib/api";

function lowestPrice(product: Product): number | null {
  const prices = product.variants
    .filter((v) => v.price !== null)
    .map((v) => parseFloat(v.price!));
  return prices.length ? Math.min(...prices) : null;
}

function ProductCard({
  product,
  categoryName,
}: {
  product: Product;
  categoryName: string | null;
}) {
  const price = lowestPrice(product);

  return (
    <div className="group flex flex-col bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl overflow-hidden transition-all duration-200">
      {/* Color band */}
      <div className="h-1 bg-brand-green opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      {/* Image */}
      <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <Package className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-6">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {categoryName && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              <Tag className="w-3 h-3" />
              {categoryName}
            </span>
          )}
          {product.made_to_order && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
              A pedido
            </span>
          )}
        </div>

        {/* Name + description */}
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1.5 leading-snug">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-4">
            {product.description}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Price + CTA */}
        <div className="flex items-end justify-between gap-3 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            {product.made_to_order ? (
              <p className="text-sm text-zinc-500">Precio a consultar</p>
            ) : price !== null ? (
              <>
                <p className="text-xs text-zinc-500 mb-0.5">Desde</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">
                  ${price.toLocaleString("es-AR")}
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Sin precio cargado</p>
            )}
          </div>

          <Link
            href={`/productos/${product.id}`}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-brand-green text-zinc-950 px-3 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Ver más
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProductsGrid({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const visible = activeCategory
    ? products.filter((p) => p.category_id === activeCategory)
    : products;

  const active = products.filter((p) => p.is_active);
  const visibleFiltered = activeCategory
    ? active.filter((p) => p.category_id === activeCategory)
    : active;

  return (
    <div className="space-y-8">
      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer ${
              activeCategory === null
                ? "bg-brand-green text-zinc-950"
                : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-brand-green text-zinc-950"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {visibleFiltered.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">
          No hay productos en esta categoría por el momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleFiltered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryName={product.category_id ? (categoryMap[product.category_id] ?? null) : null}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-600 text-right">
        {visibleFiltered.length} producto{visibleFiltered.length !== 1 ? "s" : ""}
        {activeCategory ? " en esta categoría" : " en el catálogo"}
      </p>
    </div>
  );
}
