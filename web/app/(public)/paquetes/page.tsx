import { api, Package } from "@/lib/api";
import Link from "next/link";

const complexityLabel: Record<string, string> = {
  basico: "Básico",
  medio: "Medio",
  avanzado: "Avanzado",
};

const complexityColor: Record<string, string> = {
  basico: "bg-brand-blue/10 text-brand-blue border border-brand-blue/20",
  medio: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
  avanzado: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20",
};

export default async function PaquetesPage() {
  const packages: Package[] = await api.packages.list();

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-8">
        Paquetes de Instalación
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <Link
            key={pkg.id}
            href={`/paquetes/${pkg.id}`}
            className="block bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 hover:border-brand-blue/30 rounded-2xl p-6 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-2 gap-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{pkg.name}</h2>
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${complexityColor[pkg.complexity] ?? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
              >
                {complexityLabel[pkg.complexity] ?? pkg.complexity}
              </span>
            </div>
            {pkg.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">{pkg.description}</p>
            )}
            <p className="mt-2 font-bold text-zinc-900 dark:text-white tabular-nums">
              Desde ${Number(pkg.base_price).toLocaleString("es-AR")}
            </p>
          </Link>
        ))}
        {packages.length === 0 && (
          <p className="col-span-full text-center text-zinc-500 py-12">
            No hay paquetes disponibles por el momento.
          </p>
        )}
      </div>
    </div>
  );
}
