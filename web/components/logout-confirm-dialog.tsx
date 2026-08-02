"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function LogoutConfirmDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, onCancel]);

  if (!open) return null;

  // Rendered via portal straight into <body>: a `fixed` element positions
  // relative to the nearest ancestor with a transform/filter/backdrop-filter
  // (not just the viewport), so nesting this inside e.g. PublicNav's
  // backdrop-blur header would pin it to that header's small box instead
  // of centering on the actual screen.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">¿Cerrar sesión?</h2>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Vas a salir de tu cuenta. Podés volver a ingresar cuando quieras.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-400 text-white dark:text-zinc-950 transition-colors duration-150 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
