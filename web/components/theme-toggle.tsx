"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from "@/lib/theme-store";

const VARIANT_CLASSES = {
  default:
    "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10",
  // For fixed-dark surfaces (e.g. the navy dashboard sidebar) that don't flip with the page theme.
  invert: "text-white/60 hover:text-white hover:bg-white/10",
};

export function ThemeToggle({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: keyof typeof VARIANT_CLASSES;
}) {
  const isDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  function toggle() {
    setTheme(!isDark);
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
