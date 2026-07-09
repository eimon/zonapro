import Link from "next/link";
import { Wind, Home, Leaf, Sun, Users, Zap, Shield, ArrowRight, MessageSquare } from "lucide-react";
import { PublicNav } from "@/components/public-nav";

const SERVICES = [
  {
    icon: Wind,
    title: "Climatización",
    description: "Sistemas eficientes y sostenibles para el confort térmico de tu espacio.",
  },
  {
    icon: Home,
    title: "Domótica",
    description: "Automatización y control inteligente de espacios para una vida más conectada.",
  },
  {
    icon: Leaf,
    title: "Eficiencia Térmica",
    description: "Ahorro energético y confort sustentable mediante tecnología de última generación.",
  },
  {
    icon: Sun,
    title: "Energía Solar",
    description: "Sistemas fotovoltaicos a medida para hogares y empresas.",
  },
] as const;

const VALUE_PROPS = [
  { icon: Users, label: "Equipo profesional y especializado" },
  { icon: Zap, label: "Tecnología de vanguardia" },
  { icon: Shield, label: "Compromiso con la eficiencia y el ambiente" },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <PublicNav />

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-green/10 via-zinc-50 to-zinc-50 dark:via-zinc-950 dark:to-zinc-950 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green text-xs font-medium tracking-widest uppercase">
            Hogares · Comercios · Empresas
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-zinc-900 dark:text-white leading-[1.05]">
            Tecnología que conecta,{" "}
            <span className="text-brand-green">eficiencia</span>{" "}
            que transforma.
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Soluciones inteligentes en climatización, domótica, eficiencia térmica y energía solar.
            Diseñadas y ejecutadas por expertos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/#servicios"
              className="flex items-center gap-2 bg-brand-green text-zinc-950 font-semibold px-6 py-3 rounded-xl transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
            >
              Ver servicios
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/consulta"
              className="flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium px-6 py-3 rounded-xl transition-colors duration-150"
            >
              <MessageSquare className="w-4 h-4" />
              Consultanos
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="servicios" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-brand-green text-sm font-semibold tracking-widest uppercase">
              Lo que hacemos
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">
              Nuestros servicios
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
              Conectamos tecnología, confort y eficiencia en cada proyecto.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group relative bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 hover:border-brand-green/30 rounded-2xl p-7 transition-all duration-200"
              >
                <div className="mb-5">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-green/10 border border-brand-green/20 group-hover:bg-brand-green/15 group-hover:border-brand-green/30 transition-colors duration-200">
                    <Icon className="w-6 h-6 text-brand-green" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wide mb-2">
                  {title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value props strip */}
      <section className="border-t border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {VALUE_PROPS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-4">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-brand-green/10 border border-brand-green/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-brand-green" />
              </div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">
            ¿Listo para transformar tu espacio?
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Contanos tu proyecto y un especialista te asesora sin compromiso.
          </p>
          <Link
            href="/consulta"
            className="inline-flex items-center gap-2 bg-brand-green text-zinc-950 font-semibold px-8 py-3.5 rounded-xl transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
          >
            Iniciar consulta
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} ZonaPro. Todos los derechos reservados.</p>
          <p className="text-xs tracking-widest uppercase">Tu hogar, inteligente</p>
        </div>
      </footer>
    </div>
  );
}
