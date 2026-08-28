"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  User,
} from "lucide-react";
import { api, type UserMe } from "@/lib/api";
import { getRole, getToken, subscribeAuth } from "@/lib/auth";
import { useLogout } from "@/lib/use-logout";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";

export function UserMenu() {
  const token = useSyncExternalStore(subscribeAuth, getToken, () => null);
  const role = useSyncExternalStore(subscribeAuth, getRole, () => null);
  const [user, setUser] = useState<UserMe | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { confirmOpen, requestLogout, cancelLogout, confirmLogout } = useLogout();

  useEffect(() => {
    if (!token) return;
    api.auth.me(token).then(setUser).catch(() => {});
  }, [token]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!token) {
    return (
      <Link
        href="/login"
        className="text-sm font-semibold bg-brand-blue text-white px-4 py-2 rounded-lg transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
      >
        Ingresar
      </Link>
    );
  }

  const isDashboardUser = role === "ADMIN" || role === "VENDEDOR";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors duration-150 cursor-pointer"
      >
        <span className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
          <User className="w-4 h-4" />
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-1 z-50"
        >
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
              {user ? `${user.nombre} ${user.apellido}` : "Mi cuenta"}
            </p>
            {user && (
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            )}
          </div>

          <div className="py-1">
            <Link
              href="/cuenta"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors duration-150"
            >
              <User className="w-4 h-4 shrink-0" />
              Mi cuenta
            </Link>
            <span
              role="menuitem"
              aria-disabled="true"
              className="flex items-center justify-between gap-2.5 px-4 py-2 text-sm text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            >
              <span className="flex items-center gap-2.5">
                <ShoppingBag className="w-4 h-4 shrink-0" />
                Mis pedidos
              </span>
              <span className="text-[10px] uppercase tracking-wide text-zinc-300 dark:text-zinc-700">
                Próx.
              </span>
            </span>
            <span
              role="menuitem"
              aria-disabled="true"
              className="flex items-center justify-between gap-2.5 px-4 py-2 text-sm text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            >
              <span className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 shrink-0" />
                Mis cotizaciones
              </span>
              <span className="text-[10px] uppercase tracking-wide text-zinc-300 dark:text-zinc-700">
                Próx.
              </span>
            </span>
          </div>

          {isDashboardUser && (
            <div className="py-1 border-t border-zinc-200 dark:border-zinc-800">
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors duration-150"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                Panel
              </Link>
            </div>
          )}

          <div className="py-1 border-t border-zinc-200 dark:border-zinc-800">
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                requestLogout();
              }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-600 dark:hover:text-red-300 transition-colors duration-150 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <LogoutConfirmDialog open={confirmOpen} onCancel={cancelLogout} onConfirm={confirmLogout} />
    </div>
  );
}
