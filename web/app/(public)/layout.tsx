import { Footer } from "@/components/footer";
import { PublicNav } from "@/components/public-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <PublicNav />
      <main className="flex-1 pt-20">{children}</main>
      <Footer />
    </div>
  );
}
