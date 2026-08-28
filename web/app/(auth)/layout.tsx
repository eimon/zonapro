import Link from "next/link";
import { Footer } from "@/components/footer";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-blue/10 via-zinc-50 to-zinc-50 dark:via-zinc-950 dark:to-zinc-950 pointer-events-none" />

      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-12">
        <Logo className="mb-8" />

        <div className="w-full max-w-sm">{children}</div>

        <Link
          href="/"
          className="mt-8 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors duration-150"
        >
          ← Volver al sitio
        </Link>
      </main>

      <Footer />
    </div>
  );
}
