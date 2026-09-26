import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, Package as PackageIcon } from "lucide-react";
import { api } from "@/lib/api";
import { ProductVariantPicker } from "@/components/store/product-variant-picker";
import { RelatedGrid, type RelatedEntry } from "@/components/store/related-grid";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductoDetailPage({ params }: Props) {
  const { id } = await params;

  const product = await api.products.get(id).catch(() => null);
  if (!product) notFound();

  const [packages, catalog] = await Promise.all([
    api.packages.list(),
    // A generous page_size keeps this a single request — the storefront's
    // active catalog is small (see ProductRepository.get_catalog_products).
    api.products.catalog({ page_size: 100 }),
  ]);

  // "También te puede interesar": packages that include this product first,
  // then other products (same category first), capped at 4.
  const variantIds = new Set(product.variants.map((v) => v.id));
  const relatedPackages = packages.filter((pkg) =>
    pkg.items.some((item) => item.product_variant_id && variantIds.has(item.product_variant_id))
  );
  const otherProducts = catalog.items.filter((item) => item.id !== product.id);
  const sameCategory = otherProducts.filter((item) => item.category?.slug === product.category?.slug);
  const otherCategory = otherProducts.filter((item) => item.category?.slug !== product.category?.slug);

  const relatedEntries: RelatedEntry[] = [
    ...relatedPackages.map((pkg) => ({ kind: "package" as const, package: pkg })),
    ...sameCategory.map((p) => ({ kind: "product" as const, product: p })),
    ...otherCategory.map((p) => ({ kind: "product" as const, product: p })),
  ].slice(0, 4);

  const consultaHref = `/consulta?product_id=${product.id}`;
  // No distinct "cotización" flow exists — /consulta handles both cases the
  // same way (a single Consultation row). Only the button label changes.
  const consultaLabel = product.made_to_order ? "Solicitar cotización" : "Consultar por este producto";

  return (
    <div className="px-6 py-8 lg:px-16">
      <div className="max-w-[1312px] mx-auto flex flex-col gap-10">
        <nav aria-label="Ruta" className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/productos" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            Tienda
          </Link>
          {product.category && (
            <>
              <span aria-hidden="true">/</span>
              <Link
                href={`/productos?category=${product.category.slug}`}
                className="hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span className="text-zinc-900 dark:text-white">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div className="relative aspect-square lg:aspect-auto lg:h-[600px] rounded-[20px] overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                priority
                className="object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <PackageIcon className="w-16 h-16 text-zinc-300 dark:text-zinc-700" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-7 pt-1">
            <div className="flex flex-col gap-2.5">
              {product.category && (
                <Link
                  href={`/productos?category=${product.category.slug}`}
                  className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-brand-blue"
                >
                  {product.category.name}
                </Link>
              )}
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.1]">
                {product.name}
              </h1>
              {product.description && (
                <p className="text-[16px] leading-relaxed text-zinc-600 dark:text-zinc-400">{product.description}</p>
              )}
            </div>

            <ProductVariantPicker variants={product.variants} madeToOrder={product.made_to_order} />

            <Link
              href={consultaHref}
              className="flex items-center justify-center gap-2 h-[52px] rounded-xl bg-brand-blue text-white text-base font-semibold transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
            >
              <MessageSquare className="w-4 h-4" />
              {consultaLabel}
            </Link>

            <dl className="m-0 border-t border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex justify-between py-3.5 border-b border-zinc-200 dark:border-zinc-800 text-sm">
                <dt className="text-zinc-500 dark:text-zinc-400">Categoría</dt>
                <dd className="m-0 text-zinc-900 dark:text-white">{product.category?.name ?? "Sin categoría"}</dd>
              </div>
              <div className="flex justify-between py-3.5 border-b border-zinc-200 dark:border-zinc-800 text-sm">
                <dt className="text-zinc-500 dark:text-zinc-400">Variantes</dt>
                <dd className="m-0 text-zinc-900 dark:text-white">
                  {product.variants.length === 1 ? product.variants[0].name : `${product.variants.length} variantes`}
                </dd>
              </div>
              <div className="flex justify-between py-3.5 border-b border-zinc-200 dark:border-zinc-800 text-sm">
                <dt className="text-zinc-500 dark:text-zinc-400">Alícuota IVA</dt>
                <dd className="m-0 text-zinc-900 dark:text-white">{product.iva_rate}%</dd>
              </div>
            </dl>
          </div>
        </div>

        {relatedEntries.length > 0 && (
          <section aria-labelledby="rel-title" className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="rel-title" className="text-xl font-semibold text-zinc-900 dark:text-white">
                También te puede interesar
              </h2>
              <Link href="/productos" className="text-sm font-medium text-brand-blue hover:opacity-80 transition-opacity">
                Ver la tienda →
              </Link>
            </div>
            <RelatedGrid entries={relatedEntries} />
          </section>
        )}
      </div>
    </div>
  );
}
