import Image from "next/image";
import Link from "next/link";

const SIZES = {
  default: { image: "h-[2.625rem]" },
  lg: { image: "h-[5.25rem]" },
};

export function Logo({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: keyof typeof SIZES;
}) {
  const { image } = SIZES[size];
  return (
    <Link href="/" className={`flex items-center ${className}`}>
      <Image
        src="/logo-light.png"
        alt="ZonaPro"
        width={400}
        height={140}
        priority
        className={`${image} p-3 w-auto dark:hidden`}
      />
      <Image
        src="/logo-dark.png"
        alt="ZonaPro"
        width={400}
        height={140}
        priority
        className={`${image} p-3 w-auto hidden dark:block`}
      />
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
