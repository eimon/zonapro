import Image from "next/image";
import Link from "next/link";
import { Package as PackageIcon } from "lucide-react";
import type { CatalogProductItem, Currency, Package } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { PackageImageMosaic } from "@/components/package-image-mosaic";

export type RelatedEntry =
  | { kind: "package"; package: Package }
  | { kind: "product"; product: CatalogProductItem };

// "También te puede interesar" grid — mixes package promo cards and plain
// product cards in one 4-up grid, matching the approved design. Package
// entries whose `prices[currency]` is null (not available in the selected
// currency) are skipped — the caller is expected to have already filtered
// these out, but this is a defensive no-op if not.
export function RelatedGrid({ entries, currency }: { entries: RelatedEntry[]; currency: Currency }) {
  if (entries.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 lg:grid-cols-4 gap-5 list-none m-0 p-0">
      {entries.map((entry) => {
        if (entry.kind === "package") {
          const pkg = entry.package;
          const priceInfo = pkg.prices[currency];
          if (!priceInfo) return null;
          const discount = parseFloat(priceInfo.discount_percent);
          return (
            <li key={`pkg-${pkg.id}`}>
              <Link
                href={`/paquetes/${pkg.id}?currency=${currency}`}
                className="group flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-[14px] overflow-hidden transition-colors duration-150"
              >
                <div className="relative h-[150px]">
                  <PackageImageMosaic images={pkg.items.map((i) => i.image_url)} alt={pkg.name} sizes="25vw" />
                  {discount > 0 && (
                    <span className="absolute top-2.5 left-2.5 text-xs font-semibold text-white bg-orange-700 rounded-full px-2.5 py-1">
                      Paquete -{discount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}%
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1 px-4 py-3.5">
                  <span className="text-[15px] font-semibold text-zinc-900 dark:text-white truncate">{pkg.name}</span>
                  <span className="text-[15px] font-bold text-zinc-900 dark:text-white tabular-nums">
                    {formatMoney(priceInfo.final_price, currency)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Precio sin impuestos: {formatMoney(priceInfo.final_price_net, currency)}
                  </span>
                </div>
              </Link>
            </li>
          );
        }

        const product = entry.product;
        return (
          <li key={`prod-${product.id}`}>
            <Link
              href={`/productos/${product.id}?currency=${currency}`}
              className="group flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-[14px] overflow-hidden transition-colors duration-150"
            >
              <div className="relative h-[150px] bg-zinc-100 dark:bg-zinc-800">
                {product.image_url ? (
                  <Image src={product.image_url} alt={product.name} fill sizes="25vw" className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <PackageIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 px-4 py-3.5">
                <span className="text-[15px] font-semibold text-zinc-900 dark:text-white truncate">{product.name}</span>
                <span className="text-[15px] font-bold text-zinc-900 dark:text-white tabular-nums">
                  {formatMoney(product.from_price, currency)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Precio sin impuestos: {formatMoney(product.from_price_net, currency)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
