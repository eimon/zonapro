import { ShoppingCart } from "lucide-react";

export default function OrdenesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Órdenes</h1>
      <p className="text-zinc-500 dark:text-zinc-400 mt-1">Órdenes de compra de clientes.</p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
        <ShoppingCart className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Próximamente</p>
      </div>
    </div>
  );
}
