import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, Package as PackageIcon, Boxes } from "lucide-react";
import { api, type PackageItem } from "@/lib/api";
import { PackageImageMosaic } from "@/components/package-image-mosaic";
import { formatMoney, formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const KIND_LABEL: Record<PackageItem["kind"], string> = {
  product: "Producto",
  supply: "Insumo",
};

// The backend builds item.name as "Parent — Variant" (or just the variant
// name when there's no parent) — split it back apart for the two-line row.
function splitItemName(name: string): [string, string | null] {
  const idx = name.indexOf(" — ");
  if (idx === -1) return [name, null];
  return [name.slice(0, idx), name.slice(idx + 3)];
}

export default async function PaqueteDetailPage({ params }: Props) {
  const { id } = await params;

  const pkg = await api.packages.get(id).catch(() => null);
  if (!pkg) notFound();

  const discount = parseFloat(pkg.discount_percent);
  const savings = parseFloat(pkg.list_price) - parseFloat(pkg.final_price);

  return (
    <div className="px-6 py-8 lg:px-16">
      <div className="max-w-[1312px] mx-auto flex flex-col gap-6">
        <nav aria-label="Ruta" className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/productos" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            Tienda
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/paquetes" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            Paquetes
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-zinc-900 dark:text-white">{pkg.name}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-10">
            <div className="relative h-[280px] sm:h-[420px] rounded-[20px] overflow-hidden bg-zinc-200 dark:bg-zinc-800">
              <PackageImageMosaic images={pkg.items.map((i) => i.image_url)} alt={pkg.name} sizes="(min-width: 1024px) 66vw, 100vw" iconClassName="w-14 h-14 text-zinc-400 dark:text-zinc-600" />
            </div>

            <section aria-labelledby="inc-title" className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="inc-title" className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Qué incluye
                </h2>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {pkg.items.length} ítem{pkg.items.length !== 1 ? "s" : ""} · precios de lista
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full border-collapse text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/60 text-left text-zinc-500 dark:text-zinc-400">
                      <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">
                        Producto
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-right">
                        Cantidad
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-right">
                        Precio unitario
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-right">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.items.map((item) => {
                      const [parentName, variantName] = splitItemName(item.name);
                      const thumb = (
                        <div className="relative w-14 h-14 rounded-[10px] bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center">
                          {item.image_url ? (
                            <Image src={item.image_url} alt="" fill sizes="56px" className="object-cover" />
                          ) : item.kind === "product" ? (
                            <PackageIcon className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                          ) : (
                            <Boxes className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                          )}
                        </div>
                      );
                      const label = (
                        <span className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-semibold text-zinc-900 dark:text-white truncate">{parentName}</span>
                          <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
                            {KIND_LABEL[item.kind]}
                            {variantName ? ` · ${variantName}` : ""}
                          </span>
                        </span>
                      );
                      return (
                        <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="px-5 py-3.5">
                            {item.kind === "product" && item.product_id ? (
                              <Link href={`/productos/${item.product_id}`} className="flex items-center gap-3.5 text-zinc-900 dark:text-white">
                                {thumb}
                                {label}
                              </Link>
                            ) : (
                              <div className="flex items-center gap-3.5">
                                {thumb}
                                {label}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                            {formatQty(item.quantity)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-zinc-700 dark:text-zinc-300">{formatMoney(item.unit_price)}</td>
                          <td className="px-5 py-3.5 text-right font-semibold text-zinc-900 dark:text-white">
                            {formatMoney(item.line_total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
                      <th scope="row" colSpan={3} className="px-5 py-3.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
                        Precio de lista
                      </th>
                      <td className="px-5 py-3.5 text-right">
                        <span className="block font-semibold text-zinc-900 dark:text-white">
                          {formatMoney(pkg.list_price)}
                        </span>
                        <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                          Precio sin impuestos: {formatMoney(pkg.list_price_net)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {pkg.description && (
              <section aria-labelledby="desc-title" className="flex flex-col gap-2.5 max-w-2xl">
                <h2 id="desc-title" className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Descripción
                </h2>
                <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{pkg.description}</p>
              </section>
            )}
          </div>

          <aside
            aria-label="Resumen de precio"
            className="w-full lg:w-[400px] shrink-0 lg:sticky lg:top-28 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-7 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2.5">
              <span className="self-start text-xs font-semibold text-white bg-orange-700 rounded-full px-2.5 py-1">
                Paquete promocional
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-zinc-900 dark:text-white">
                {pkg.name}
              </h1>
            </div>

            <div className="flex flex-col gap-1.5 py-4.5 border-t border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                <span>Precio de lista</span>
                <span className="line-through">{formatMoney(pkg.list_price)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm font-medium text-orange-700 dark:text-orange-400">
                  <span>Descuento {discount.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</span>
                  <span>− {formatMoney(String(savings))}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2">
                <span className="text-[15px] font-semibold text-zinc-900 dark:text-white">Precio del paquete</span>
                <span className="text-[32px] font-bold tracking-tight tabular-nums text-zinc-900 dark:text-white">
                  {formatMoney(pkg.final_price)}
                </span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 text-right">
                Precio sin impuestos: {formatMoney(pkg.final_price_net)}
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
              <span className={`w-2 h-2 rounded-full ${pkg.is_available ? "bg-emerald-500" : "bg-zinc-400"}`} />
              {pkg.is_available ? "Todos los ítems disponibles" : "Paquete no disponible"}
            </div>

            <Link
              href={`/consulta?package_id=${pkg.id}`}
              className="flex items-center justify-center gap-2 h-[52px] rounded-xl bg-brand-blue text-white text-base font-semibold transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
            >
              <MessageSquare className="w-4 h-4" />
              Consultar por este paquete
            </Link>

            <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-500">
              El descuento se aplica sobre el precio de lista vigente de cada ítem.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
