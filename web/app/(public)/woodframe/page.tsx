import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WoodFrame · ZonaPro",
  description:
    "Del plano en 2D a la estructura de madera en 3D. Herramienta de apoyo para arquitectos.",
};

const STEPS = [
  { title: "Plano", description: "Subís plantas, cortes y vistas. La app reconoce cada hoja." },
  { title: "Datos del proyecto", description: "Completás ubicación, escuadrías y terminaciones." },
  { title: "Revisión guiada", description: "Confirmás lo que el plano no define antes de generar." },
  { title: "Resultados", description: "Recorrés el visor y descargás toda la documentación." },
] as const;

const DELIVERABLES = [
  {
    title: "Visor 3D",
    description: "Cada pieza de la estructura, con modo de presentación, medición y recorrido del sol.",
  },
  {
    title: "Detalles constructivos",
    description: "Encuentros, anclajes, dinteles y fijaciones, con las medidas del proyecto.",
  },
  { title: "Planos en PDF", description: "Láminas de arquitectura listas para imprimir." },
  { title: "Cómputo de madera", description: "Listado de piezas para pedir el material." },
  { title: "Modelos para otros programas", description: "SketchUp, IFC, OBJ y GLB." },
  {
    title: "Datos para el calculista",
    description:
      "Secciones predimensionadas, viento, nieve y sismo de la zona para que el profesional valide la estructura.",
  },
] as const;

const EXAMPLES = [
  {
    src: "/woodframe/panel.svg",
    alt: "Dibujo de un muro de madera con abertura, bloqueos y tablero",
    title: "Muros",
    description: "Montantes, soleras, dinteles, bloqueos y tableros.",
  },
  {
    src: "/woodframe/esquina.svg",
    alt: "Dibujo de un encuentro de esquina entre dos muros de madera",
    title: "Encuentros",
    description: "Esquinas y uniones de muros resueltas según cada caso.",
  },
] as const;

const PRIMARY_BUTTON =
  "inline-block bg-brand-blue text-white font-semibold px-6 py-3 rounded-xl transition-[filter] duration-150 hover:brightness-110 active:brightness-95";
const SECONDARY_BUTTON =
  "inline-block border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium px-6 py-3 rounded-xl transition-colors duration-150";

export default function WoodFramePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[radial-gradient(900px_520px_at_72%_42%,rgba(50,111,200,0.15),transparent_70%)]">
        <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-[1fr_1.25fr] items-center gap-6">
          <div>
            <span className="inline-block px-3 py-1.5 rounded-full bg-brand-blue/10 border border-brand-blue/20 text-brand-blue text-xs font-medium tracking-widest uppercase">
              Para arquitectos
            </span>
            <h1 className="mt-5 mb-4 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
              Del plano en 2D a la <span className="text-brand-blue">estructura</span> de madera en
              3D.
            </h1>
            <p className="max-w-xl text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Subís los planos de la casa y WoodFrame arma la estructura predimensionada, los
              detalles constructivos y la documentación para que la revise y firme el profesional.
            </p>
            <p className="mt-3 mb-7 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              Herramienta de apoyo: el responsable es quien firma.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/consulta" className={PRIMARY_BUTTON}>
                Consultanos
              </Link>
              <a href="#como" className={SECONDARY_BUTTON}>
                Cómo funciona
              </a>
            </div>
          </div>
          <Image
            src="/woodframe/casa.svg"
            alt="Dibujo de la estructura de madera de una casa, con muros y cabios"
            width={1200}
            height={860}
            priority
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* Steps */}
      <section id="como" className="py-16 md:py-20 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            Cuatro pasos, de la planta al visor
          </h2>
          <p className="mt-3 mb-10 max-w-xl text-zinc-500 dark:text-zinc-400">
            Trabajás con los planos que ya tenés, en DXF o PDF.
          </p>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 border-t border-zinc-200 dark:border-zinc-800">
            {STEPS.map((step, i) => (
              <li key={step.title} className="pt-6 pr-6">
                <span className="block text-sm font-semibold text-brand-blue mb-2">{i + 1}</span>
                <h3 className="text-lg font-semibold mb-1.5">{step.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Deliverables */}
      <section className="py-16 md:py-20 bg-white dark:bg-zinc-900/50 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Todo lo que recibís</h2>
          <p className="mt-3 mb-10 max-w-xl text-zinc-500 dark:text-zinc-400">
            Cada proyecto sale con su visor y su documentación.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-9 gap-y-7">
            {DELIVERABLES.map((item) => (
              <div key={item.title}>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-xl text-zinc-500 dark:text-zinc-400">
            WoodFrame es una herramienta de apoyo: el responsable es quien firma. Las secciones son
            un predimensionado que debe validar un profesional matriculado.
          </p>
        </div>
      </section>

      {/* Examples */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Pieza por pieza</h2>
          <p className="mt-3 mb-10 max-w-xl text-zinc-500 dark:text-zinc-400">
            La estructura se resuelve hasta el detalle de cada encuentro. Dibujos ilustrativos.
          </p>
          <div className="grid md:grid-cols-2 gap-5">
            {EXAMPLES.map((example) => (
              <figure
                key={example.title}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden"
              >
                <Image
                  src={example.src}
                  alt={example.alt}
                  width={760}
                  height={560}
                  className="w-full h-auto px-3 pt-3"
                />
                <figcaption className="px-5 pt-1.5 pb-5 text-sm text-zinc-500 dark:text-zinc-400">
                  <b className="block text-base text-zinc-900 dark:text-zinc-100">
                    {example.title}
                  </b>
                  {example.description}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16 md:pb-20 text-center">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            ¿Tenés un proyecto para probar?
          </h2>
          <p className="mt-3 mb-6 text-zinc-500 dark:text-zinc-400">
            Contanos qué estás proyectando.
          </p>
          <Link href="/consulta" className={PRIMARY_BUTTON}>
            Consultanos
          </Link>
        </div>
      </section>
    </>
  );
}
