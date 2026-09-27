"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, type Product, type Supply, type PackageInput } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { PackageForm } from "../package-form";

export default function NuevoPaquetePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([api.products.list(), api.supplies.list(token)])
      .then(([p, s]) => {
        setProducts(p);
        setSupplies(s);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSubmit = async (data: PackageInput) => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    await api.packages.create(data, token);
    router.push("/dashboard/paquetes");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/paquetes"
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
          aria-label="Volver a paquetes"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">Nuevo paquete</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Armá un combo promocional con productos e insumos del catálogo
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando catálogo...</p>
      ) : (
        <PackageForm
          mode="create"
          products={products}
          supplies={supplies}
          defaultValues={{
            name: "",
            slug: "",
            description: "",
            is_active: true,
            pricing_mode: "discount_percent",
            pricing_value: "",
          }}
          onSubmit={handleSubmit}
          submitLabel="Crear paquete"
          cancelHref="/dashboard/paquetes"
        />
      )}
    </div>
  );
}
