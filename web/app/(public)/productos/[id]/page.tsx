"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { api, type Product, type ProductVariant } from "@/lib/api";
import { ArrowLeft, MessageSquare, Package, Tag, CheckCircle2, Clock } from "lucide-react";

// Customer-facing price: final price (net + IVA), what the customer actually pays.
function lowestPrice(product: Product): number | null {
  const prices = product.variants
    .map((v) => parseFloat(v.final_price))
    .filter((p) => !Number.isNaN(p));
  return prices.length ? Math.min(...prices) : null;
}

function variantPrice(v: ProductVariant): number | null {
  const final = parseFloat(v.final_price);
  return Number.isNaN(final) ? null : final;
}

function SkeletonDetail() {
  return (
    <div className="py-16 px-6 animate-pulse">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-9 w-80 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-full max-w-xl bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProductoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    api.products
      .get(id)
      .then((p) => {
        setProduct(p);
        if (p.variants.length === 1) setSelectedVariant(p.variants[0]);
      })
      .catch(() => setNotFoundFlag(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SkeletonDetail />;
  if (notFoundFlag || !product) {
    return (
      <div className="py-32 px-6 text-center text-zinc-500">
        Producto no encontrado.{" "}
        <Link href="/productos" className="text-brand-green hover:underline">
          Ver catálogo
        </Link>
      </div>
    );
  }

  const displayPrice = selectedVariant
    ? variantPrice(selectedVariant)
    : lowestPrice(product);

  const hasMultipleVariants = product.variants.length > 1;
  const consultaHref = `/consulta?product_id=${product.id}`;

  return (
    <div className="py-16 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back */}
        <Link
          href="/productos"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al catálogo
        </Link>

        {/* Image */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 896px, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <Package className="w-14 h-14 text-zinc-300 dark:text-zinc-700" />
            </div>
          )}
        </div>

        {/* Header */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {product.made_to_order && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                <Clock className="w-3 h-3" />
                A pedido
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white leading-tight">
            {product.name}
          </h1>

          {product.description && (
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">{product.description}</p>
          )}
        </div>

        {/* Variants */}
        {product.variants.length > 0 && (
          <div className="space-y-4">
            {hasMultipleVariants && (
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {selectedVariant ? "Variante seleccionada:" : "Seleccioná una variante:"}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {product.variants.map((v) => {
                const price = variantPrice(v);
                const isSelected = selectedVariant?.id === v.id;
                const inStock = product.made_to_order || v.stock_qty > 0;

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    disabled={!hasMultipleVariants}
                    className={`relative text-left p-4 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-brand-green/10 border-brand-green/50 ring-1 ring-brand-green/30"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                    } ${!hasMultipleVariants ? "cursor-default" : ""}`}
                  >
                    {isSelected && (
                      <CheckCircle2 className="absolute top-3 right-3 w-4 h-4 text-brand-green" />
                    )}
                    <p className={`font-medium text-sm ${isSelected ? "text-brand-green" : "text-zinc-900 dark:text-white"}`}>
                      {v.name}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">{v.sku}</p>
                    <div className="mt-3 flex items-end justify-between">
                      {product.made_to_order ? (
                        <span className="text-xs text-zinc-500">A consultar</span>
                      ) : price !== null ? (
                        <p className="text-base font-bold text-zinc-900 dark:text-white tabular-nums">
                          ${price.toLocaleString("es-AR")}
                        </p>
                      ) : (
                        <span className="text-xs text-zinc-500">Sin precio</span>
                      )}
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          inStock
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {product.made_to_order
                          ? "A pedido"
                          : v.stock_qty > 0
                          ? `${v.stock_qty} en stock`
                          : "Sin stock"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Price summary + CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <div>
            {product.made_to_order ? (
              <>
                <p className="text-sm text-zinc-500 mb-1">Precio</p>
                <p className="text-xl font-semibold text-zinc-700 dark:text-zinc-300">A consultar</p>
              </>
            ) : displayPrice !== null ? (
              <>
                <p className="text-sm text-zinc-500 mb-1">
                  {hasMultipleVariants && !selectedVariant ? "Desde" : "Precio"}
                </p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                  ${displayPrice.toLocaleString("es-AR")}
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Consultá el precio</p>
            )}
          </div>

          <Link
            href={consultaHref}
            className="flex items-center gap-2 bg-brand-green text-zinc-950 font-semibold px-6 py-3 rounded-xl transition-[filter] duration-150 hover:brightness-110 active:brightness-95 whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4" />
            {product.made_to_order ? "Solicitar cotización" : "Consultar"}
          </Link>
        </div>
      </div>
    </div>
  );
}
