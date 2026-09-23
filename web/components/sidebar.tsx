"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileText,
  HardHat,
  LayoutDashboard,
  Layers,
  LogOut,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Store,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { getRole, subscribeAuth } from "@/lib/auth";
import {
  getSidebarCollapsedServerSnapshot,
  getSidebarCollapsedSnapshot,
  setSidebarCollapsed,
  subscribeSidebarCollapsed,
} from "@/lib/sidebar-store";
import { useLogout } from "@/lib/use-logout";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/productos", icon: Package, label: "Productos" },
  { href: "/dashboard/paquetes", icon: Layers, label: "Paquetes" },
  { href: "/dashboard/consultas", icon: MessageSquare, label: "Consultas" },
  { href: "/dashboard/cotizaciones", icon: FileText, label: "Cotizaciones" },
  { href: "/dashboard/ordenes", icon: ShoppingCart, label: "Órdenes" },
];

const ADMIN_NAV_ITEMS = [
  { href: "/dashboard/usuarios", icon: Users, label: "Usuarios" },
];

// Insumos + Cotizar Servicios + Cotizaciones construcción live in their own
// group, separated from the rest of the top menu — they're distinct
// workflows (materials/labor quotes) rather than the storefront-facing
// catalog/order items above.
const SERVICIOS_NAV_ITEMS = [
  { href: "/dashboard/insumos", icon: Boxes, label: "Insumos" },
  { href: "/dashboard/cotizaciones-servicios", icon: Wrench, label: "Cotizar Servicios" },
  { href: "/dashboard/cotizaciones-construccion", icon: HardHat, label: "Cotizaciones construcción" },
];

const BOTTOM_ITEMS = [
  { href: "/dashboard/perfil", icon: User, label: "Mi perfil" },
  { href: "/dashboard/configuracion", icon: Settings, label: "Configuración" },
];

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );
  const isAdmin = useSyncExternalStore(
    subscribeAuth,
    () => getRole() === "ADMIN",
    () => false,
  );

  const toggle = () => setSidebarCollapsed(!collapsed);
  const { confirmOpen, requestLogout, cancelLogout, confirmLogout } = useLogout();

  // Labels are always shown on mobile (the drawer is always full-width there);
  // `collapsed` only hides them at the md breakpoint and up.
  const labelClass = collapsed ? "md:hidden" : "";

  useEffect(() => {
    if (!mobileOpen) return;
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseMobile();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col h-screen w-64 bg-zinc-900 text-white shrink-0 transition-all duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-16" : "md:w-64"}`}
      >
        {/* Header */}
        <div
          className={`flex items-center h-16 border-b border-white/10 px-3 gap-2 ${
            collapsed ? "md:justify-center md:px-2" : ""
          }`}
        >
          <div className={`flex items-center gap-2 flex-1 min-w-0 ${labelClass}`}>
            <LogoMark className="w-8 h-8 shrink-0" />
            <span className="font-semibold text-sm tracking-tight whitespace-nowrap">
              ZonaPro
            </span>
          </div>
          {/* Desktop collapse toggle */}
          <button
            onClick={toggle}
            className={`hidden md:flex p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer shrink-0 ${
              collapsed ? "" : "ml-auto"
            }`}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer shrink-0 ml-auto"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {(isAdmin ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS).map(({ href, icon: Icon, label }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-brand-blue text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={labelClass}>{label}</span>
              </Link>
            );
          })}

          <div className="my-2 border-t border-white/10" role="separator" />

          {SERVICIOS_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-brand-blue text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={labelClass}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom nav */}
        <div className="py-3 px-2 border-t border-white/10 space-y-0.5">
          <div className={collapsed ? "flex md:justify-center" : ""}>
            <ThemeToggle variant="invert" />
          </div>
          {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={onCloseMobile}
              title={collapsed ? label : undefined}
              className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className={labelClass}>{label}</span>
            </Link>
          ))}
          <Link
            href="/"
            onClick={onCloseMobile}
            title={collapsed ? "Ir a la tienda" : undefined}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <Store className="w-5 h-5 shrink-0" />
            <span className={labelClass}>Ir a la tienda</span>
          </Link>
          <button
            onClick={requestLogout}
            title={collapsed ? "Cerrar sesión" : undefined}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer whitespace-nowrap w-full"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={labelClass}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <LogoutConfirmDialog open={confirmOpen} onCancel={cancelLogout} onConfirm={confirmLogout} />
    </>
  );
}
