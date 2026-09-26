import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Package } from "@/lib/api";
import { PackageImageMosaic } from "@/components/package-image-mosaic";
import { formatMoney, formatQty } from "@/lib/format";

// Shown at most 2 promo packages here — this is a highlight strip above the
// grid, not the full listing (that's /paquetes).
const MAX_VISIBLE = 2;

export function PromoPackages({ packages }: { packages: Package[] }) {
  const visible = packages.slice(0, MAX_VISIBLE);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="promo-packages-title" className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="promo-packages-title" className="text-lg font-semibold text-zinc-900 dark:text-white">
          Paquetes promocionales
        </h2>
        <Link
          href="/paquetes"
          className="shrink-0 text-sm font-medium text-brand-blue hover:opacity-80 transition-opacity flex items-center gap-1"
        >
          Ver todos los paquetes
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        {visible.map((pkg) => {
          const discount = parseFloat(pkg.discount_percent);
          const savings = parseFloat(pkg.list_price) - parseFloat(pkg.final_price);
          const itemsSummary = pkg.items.map((i) => `${formatQty(i.quantity)} × ${i.name}`).join(" · ");

          return (
            <Link
              key={pkg.id}
              href={`/paquetes/${pkg.id}`}
              className="group flex flex-col sm:flex-row bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl overflow-hidden transition-colors duration-150"
            >
              <div className="relative w-full sm:w-[280px] h-[160px] sm:h-[188px] shrink-0">
                <PackageImageMosaic images={pkg.items.map((i) => i.image_url)} alt={pkg.name} sizes="(min-width: 640px) 280px, 100vw" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 sm:px-7 py-5">
                <div className="flex flex-col gap-2 min-w-0">
                  {discount > 0 && (
                    <span className="self-start text-xs font-semibold text-white bg-orange-700 rounded-full px-2.5 py-1">
                      -{discount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}%
                    </span>
                  )}
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">{pkg.name}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1">{itemsSummary}</p>
                </div>
                <div className="flex flex-col items-start sm:items-end justify-end gap-0.5 shrink-0">
                  <span className="text-sm text-zinc-500 dark:text-zinc-500 line-through">{formatMoney(pkg.list_price)}</span>
                  <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
                    {formatMoney(pkg.final_price)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Precio sin impuestos: {formatMoney(pkg.final_price_net)}
                  </span>
                  {savings > 0 && (
                    <span className="text-[13px] font-medium text-orange-700 dark:text-orange-400">
                      Ahorrás {formatMoney(String(savings))}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
