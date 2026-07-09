import Image from "next/image";
import Link from "next/link";

const SIZES = {
  default: { image: "h-7", chip: "px-2.5 py-1.5" },
  lg: { image: "h-14", chip: "px-3 py-2" },
};

export function Logo({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: keyof typeof SIZES;
}) {
  const { image, chip } = SIZES[size];
  return (
    <Link href="/" className={`flex items-center ${className}`}>
      {/* White backdrop: the logo's navy wordmark is unreadable directly on a dark background */}
      <span className={`inline-flex items-center bg-white rounded-lg ${chip}`}>
        <Image
          src="/logo.png"
          alt="ZonaPro"
          width={423}
          height={138}
          priority
          className={`${image} w-auto`}
        />
      </span>
    </Link>
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/favicon.png"
      alt="ZonaPro"
      width={501}
      height={501}
      className={className}
    />
  );
}
