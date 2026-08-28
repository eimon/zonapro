"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff, Link2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

const inputClass =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all duration-150";

type Mode = "upload" | "url";

export function ProductImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(value && !value.startsWith("/") ? "url" : "upload");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setUploadError(null);
    onChange(""); // the two sources are mutually exclusive — switching clears the other
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const token = getToken();
    if (!token) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await api.products.uploadImage(file, token);
      onChange(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950/60">
        <button
          type="button"
          onClick={() => switchMode("upload")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer ${
            mode === "upload"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Subir imagen
        </button>
        <button
          type="button"
          onClick={() => switchMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer ${
            mode === "url"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          URL
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          {value ? (
            <Image src={value} alt="" fill sizes="56px" className="object-cover" />
          ) : (
            <ImageOff className="w-5 h-5 text-zinc-300 dark:text-zinc-700" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {mode === "upload" ? (
            <div className="space-y-1">
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:opacity-80 transition-opacity cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Subiendo..." : value ? "Reemplazar imagen" : "Elegir archivo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
              {uploadError && <p className="text-xs text-red-500 dark:text-red-400">{uploadError}</p>}
            </div>
          ) : (
            <input
              type="text"
              placeholder="https://..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={inputClass}
            />
          )}
        </div>
      </div>
    </div>
  );
}
