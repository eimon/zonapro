"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
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

const BOTTOM_ITEMS = [
  { href: "/dashboard/perfil", icon: User, label: "Mi perfil" },
  { href: "/dashboard/configuracion", icon: Settings, label: "Configuración" },
];

export function Sidebar() {
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

  return (
    <aside
      className={`relative flex flex-col h-screen bg-brand-blue text-white shrink-0 transition-all duration-200 ease-in-out ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center h-16 border-b border-white/10 ${
          collapsed ? "justify-center px-2" : "px-3 gap-2"
        }`}
      >
        {!collapsed && (
          <>
            <LogoMark className="w-8 h-8 shrink-0" />
            <span className="font-semibold text-sm tracking-tight whitespace-nowrap flex-1">
              ZonaPro
            </span>
          </>
        )}
        <button
          onClick={toggle}
          className={`p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer shrink-0 ${
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
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-brand-green text-zinc-950"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="py-3 px-2 border-t border-white/10 space-y-0.5">
        <div className={collapsed ? "flex justify-center" : ""}>
          <ThemeToggle variant="invert" />
        </div>
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}
        <Link
          href="/"
          title={collapsed ? "Ir a la tienda" : undefined}
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <Store className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Ir a la tienda</span>}
        </Link>
        <button
          onClick={requestLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer whitespace-nowrap w-full"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      <LogoutConfirmDialog open={confirmOpen} onCancel={cancelLogout} onConfirm={confirmLogout} />
    </aside>
  );
}
