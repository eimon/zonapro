"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, type Product, type Supply, type Package, type PackageInput } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { PackageForm } from "../../package-form";
import type { PackageItemDraft } from "@/components/package-items-editor";

function toItemDrafts(pkg: Package): PackageItemDraft[] {
  return pkg.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    product_variant_id: item.product_variant_id ?? undefined,
    supply_variant_id: item.supply_variant_id ?? undefined,
    name: item.name,
    sku: item.sku,
    // NET, not the gross item.unit_price — drafts always carry the NET price
    // (see PackageItemDraft.unit_price), the pricing basis the form previews from.
    unit_price: item.unit_price_net,
    iva_rate: item.iva_rate,
    quantity: item.quantity,
    display_order: item.display_order,
    image_url: item.image_url,
  }));
}

export default function EditarPaquetePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([api.packages.getAdmin(id, token), api.products.list(), api.supplies.list(token)])
      .then(([p, products, supplies]) => {
        setPkg(p);
        setProducts(products);
        setSupplies(supplies);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleSubmit = async (data: PackageInput) => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    await api.packages.update(id, data, token);
    router.push("/dashboard/paquetes");
  };

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando paquete...</p>;
  }

  if (notFound || !pkg) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-500 dark:text-red-400">Paquete no encontrado.</p>
        <Link href="/dashboard/paquetes" className="text-sm text-brand-blue hover:underline">
          Volver a paquetes
        </Link>
      </div>
    );
  }

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
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">Editar paquete</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{pkg.name}</p>
        </div>
      </div>

      <PackageForm
        mode="edit"
        products={products}
        supplies={supplies}
        defaultValues={{
          name: pkg.name,
          slug: pkg.slug,
          description: pkg.description ?? "",
          is_active: pkg.is_active,
          pricing_mode: pkg.pricing_mode,
          pricing_value: pkg.pricing_value,
        }}
        initialItems={toItemDrafts(pkg)}
        onSubmit={handleSubmit}
        submitLabel="Guardar cambios"
        cancelHref="/dashboard/paquetes"
      />
    </div>
  );
}
