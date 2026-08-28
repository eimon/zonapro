import { api, Package } from "@/lib/api";
import Link from "next/link";
import { notFound } from "next/navigation";

const complexityLabel: Record<string, string> = {
  basico: "Básico",
  medio: "Medio",
  avanzado: "Avanzado",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaqueteDetailPage({ params }: Props) {
  const { id } = await params;

  let pkg: Package;
  try {
    pkg = await api.packages.get(id);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-6">
        <Link href="/paquetes" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          ← Volver a paquetes
        </Link>
      </div>

      <div className="flex items-start justify-between mb-4 gap-4">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{pkg.name}</h1>
        <span className="mt-1 shrink-0 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full">
          {complexityLabel[pkg.complexity] ?? pkg.complexity}
        </span>
      </div>

      {pkg.description && (
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">{pkg.description}</p>
      )}

      <p className="text-xl font-semibold text-zinc-900 dark:text-white mb-8">
        Precio base: ${Number(pkg.base_price).toLocaleString("es-AR")}
      </p>

      {pkg.option_groups.length > 0 && (
        <div className="space-y-6 mb-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Opciones del paquete</h2>
          {pkg.option_groups.map((group) => (
            <div key={group.id} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-3">{group.name}</h3>
              <div className="space-y-2">
                {group.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {option.is_default && (
                        <span className="text-xs bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded">
                          Incluida
                        </span>
                      )}
                      <span className="text-zinc-700 dark:text-zinc-300">{option.label}</span>
                    </div>
                    {Number(option.price_delta) !== 0 && (
                      <span className="text-zinc-500">
                        {Number(option.price_delta) > 0 ? "+" : ""}
                        ${Number(option.price_delta).toLocaleString("es-AR")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href={`/consulta?package_id=${pkg.id}`}
        className="inline-block bg-brand-blue text-white px-6 py-3 rounded-xl transition-[filter] hover:brightness-110 active:brightness-95 font-semibold"
      >
        Solicitar consulta
      </Link>
    </div>
  );
}
