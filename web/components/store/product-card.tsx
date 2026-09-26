import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import type { CatalogProductItem } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const AVAILABILITY_DOT: Record<string, string> = {
  in_stock: "bg-emerald-500",
  made_to_order: "bg-orange-600",
  out_of_stock: "bg-zinc-400 dark:bg-zinc-600",
};
const AVAILABILITY_LABEL: Record<string, string> = {
  in_stock: "En stock",
  made_to_order: "A pedido",
  out_of_stock: "Sin stock",
};

export function ProductCard({ item }: { item: CatalogProductItem }) {
  return (
    <Link
      href={`/productos/${item.id}`}
      className="group flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-[0_6px_20px_-8px_rgba(24,24,27,0.18)] dark:hover:shadow-none rounded-2xl overflow-hidden transition-[border-color,box-shadow] duration-150"
    >
      <div className="relative h-[220px] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
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
      <div className="flex flex-col flex-1 gap-1.5 px-5 pt-4 pb-5">
        {item.category && (
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{item.category.name}</span>
        )}
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white leading-snug">{item.name}</h3>
        <span className="text-[13px] text-zinc-600 dark:text-zinc-400">{item.variants_label}</span>
        <div className="flex-1" />
        <div className="flex items-end justify-between gap-3 pt-3">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              {item.has_multiple_prices ? "Desde" : "Precio final"}
            </span>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
              {formatMoney(item.from_price)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Precio sin impuestos: {formatMoney(item.from_price_net)}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-[13px] text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${AVAILABILITY_DOT[item.availability]}`} />
            {AVAILABILITY_LABEL[item.availability]}
          </span>
        </div>
      </div>
    </Link>
  );
}
