import { api, type Package } from "@/lib/api";
import Link from "next/link";
import { PackageImageMosaic } from "@/components/package-image-mosaic";
import { formatMoney } from "@/lib/format";

export const revalidate = 60;

function PackageCard({ pkg }: { pkg: Package }) {
  const discount = parseFloat(pkg.discount_percent);
  return (
    <Link
      href={`/paquetes/${pkg.id}`}
      className="group flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-[0_6px_20px_-8px_rgba(24,24,27,0.18)] dark:hover:shadow-none rounded-2xl overflow-hidden transition-[border-color,box-shadow] duration-150"
    >
      <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <PackageImageMosaic
          images={pkg.items.map((item) => item.image_url)}
          alt={pkg.name}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
        {discount > 0 && (
          <span className="absolute top-3 right-3 bg-orange-700 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            -{discount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}%
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1 gap-1.5 px-5 pt-4 pb-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white leading-snug">{pkg.name}</h2>
        {pkg.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">{pkg.description}</p>
        )}
        <div className="flex-1" />
        <div className="flex items-end gap-2 pt-3">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 line-through">{formatMoney(pkg.list_price)}</span>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
              {formatMoney(pkg.final_price)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Precio sin impuestos: {formatMoney(pkg.final_price_net)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function PaquetesPage() {
  const packages: Package[] = await api.packages.list();

  return (
    <div className="max-w-[1312px] mx-auto px-6 py-9 lg:px-16">
      <nav aria-label="Ruta" className="flex gap-2 text-[13px] text-zinc-500 dark:text-zinc-400 mb-5">
        <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/productos" className="hover:text-zinc-700 dark:hover:text-zinc-200">
          Tienda
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-zinc-900 dark:text-white">Paquetes</span>
      </nav>

      <div className="flex flex-col gap-1.5 mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">Paquetes promocionales</h1>
        <p className="text-[15px] text-zinc-600 dark:text-zinc-400 max-w-xl">Combos de productos e insumos a precio especial.</p>
      </div>

      {packages.length === 0 ? (
        <p className="text-center text-zinc-500 py-20">No hay paquetes disponibles por el momento.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none m-0 p-0">
          {packages.map((pkg) => (
            <li key={pkg.id}>
              <PackageCard pkg={pkg} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
