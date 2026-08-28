import Image from "next/image";
import Link from "next/link";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import iconMark from "@/app/icon.png";

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
        src={logoLight}
        alt="ZonaPro"
        priority
        className={`${image} p-3 w-auto dark:hidden`}
      />
      <Image
        src={logoDark}
        alt="ZonaPro"
        priority
        className={`${image} p-3 w-auto hidden dark:block`}
      />
    </Link>
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src={iconMark}
      alt="ZonaPro"
      className={className}
    />
  );
}
