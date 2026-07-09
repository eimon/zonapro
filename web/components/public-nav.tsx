import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export function PublicNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800/60">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Logo size="lg" />

        <nav className="hidden md:flex items-center gap-8" aria-label="Navegación principal">
          <Link
            href="/"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors duration-150"
          >
            Inicio
          </Link>
          <Link
            href="/#servicios"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors duration-150"
          >
            Servicios
          </Link>
          <Link
            href="/productos"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors duration-150"
          >
            Tienda
          </Link>
          <Link
            href="/consulta"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors duration-150"
          >
            Contacto
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
