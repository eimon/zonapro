import Link from "next/link";
import { Logo } from "@/components/logo";
import { FacebookIcon, InstagramIcon, LinkedinIcon } from "@/components/social-icons";

const LINK_COLUMNS = [
  {
    title: "Empresa",
    links: [
      { href: "/", label: "Inicio" },
      { href: "/productos", label: "Tienda" },
      { href: "/paquetes", label: "Paquetes" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "/consulta", label: "Contacto" },
      { href: "/terminos", label: "Términos y condiciones" },
      { href: "/privacidad", label: "Privacidad" },
    ],
  },
];

const SOCIAL_LINKS = [
  { href: "#", label: "Instagram", icon: InstagramIcon },
  { href: "#", label: "Facebook", icon: FacebookIcon },
  { href: "#", label: "LinkedIn", icon: LinkedinIcon },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Logo className="-ml-3" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs">
              Soluciones inteligentes en climatización, domótica, eficiencia térmica y energía solar.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors duration-150"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {LINK_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                {column.title}
              </h3>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            © {year} ZonaPro. Todos los derechos reservados.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Desarrollado por{" "}
            <a
              href="https://eimon.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 dark:text-zinc-400 hover:text-brand-blue transition-colors duration-150"
            >
              eimon.dev
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
