import { api } from "@/lib/api";
import { ProductsGrid } from "@/components/products-grid";

export const revalidate = 60;

export default async function ProductosPage() {
  const [products, categories] = await Promise.all([
    api.products.list(),
    api.categories.list(),
  ]);

  return (
    <div className="py-16 px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="space-y-3">
          <p className="text-brand-green text-sm font-semibold tracking-widest uppercase">
            Catálogo
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">
            Nuestros productos
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-xl">
            Equipos y soluciones para climatización, domótica, eficiencia térmica y energía solar.
          </p>
        </div>

        <ProductsGrid products={products} categories={categories} />
      </div>
    </div>
  );
}
