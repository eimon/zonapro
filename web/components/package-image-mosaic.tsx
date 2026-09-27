import Image from "next/image";
import { Layers } from "lucide-react";

// Shared by every package image surface (storefront cards, package detail
// hero, "Paquetes promocionales" section, dashboard list) — renders the
// package's item images as a mosaic instead of the old placeholder icon.
// Must be placed inside a `relative` container with defined dimensions
// (e.g. `relative aspect-[4/3]`), since it fills that container with
// `absolute inset-0`.
export function PackageImageMosaic({
  images,
  alt,
  sizes = "400px",
  iconClassName = "w-10 h-10 text-zinc-300 dark:text-zinc-700",
}: {
  images: (string | null | undefined)[];
  alt: string;
  sizes?: string;
  iconClassName?: string;
}) {
  // Dedup — the same product/supply can appear more than once in a package
  // (e.g. 2 different quantities aren't possible, but a product and one of
  // its own accessories could share an image) — and cap at 4 for the mosaic.
  const unique = Array.from(new Set(images.filter((url): url is string => Boolean(url)))).slice(0, 4);

  if (unique.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Layers className={iconClassName} />
      </div>
    );
  }

  if (unique.length === 1) {
    return <Image src={unique[0]} alt={alt} fill sizes={sizes} className="object-cover" />;
  }

  if (unique.length === 2) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        {unique.map((src) => (
          <div key={src} className="relative">
            <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
          </div>
        ))}
      </div>
    );
  }

  if (unique.length === 3) {
    const [first, second, third] = unique;
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        <div className="relative">
          <Image src={first} alt={alt} fill sizes={sizes} className="object-cover" />
        </div>
        <div className="grid grid-rows-2 gap-0.5">
          <div className="relative">
            <Image src={second} alt={alt} fill sizes={sizes} className="object-cover" />
          </div>
          <div className="relative">
            <Image src={third} alt={alt} fill sizes={sizes} className="object-cover" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
      {unique.map((src) => (
        <div key={src} className="relative">
          <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
        </div>
      ))}
    </div>
  );
}
