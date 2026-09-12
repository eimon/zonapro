"use client";

import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  MessageSquare,
  Package,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type DashboardStats } from "@/lib/api";
import { getRole, getToken, subscribeAuth } from "@/lib/auth";
import { getThemeServerSnapshot, getThemeSnapshot, subscribeTheme } from "@/lib/theme-store";

// Categorical palette anchored to the brand accent (#326fc8 — see
// api/core/branding.py's ACCENT_COLOR and Tailwind's `brand-blue`), validated
// with the dataviz skill's validator against both surfaces:
//   node validate_palette.js "#326fc8,#eb6834,#1baf7a,#eda100,#e87ba4,#008300,#4a3aa7,#e34948" --mode light
//   node validate_palette.js "#4a84e0,#d95926,#199e70,#c98500,#d55181,#008300,#9085e9,#e66767" --mode dark
// Both PASS all hard gates (worst adjacent CVD 9.1 light / 8.4 dark,
// normal-vision 19.6 light / 19.3 dark). Only slots 1 (productos) and 2
// (servicios) are used here, for the two-series time chart.
const PALETTE = {
  light: {
    surface: "#fcfcfb",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    textMuted: "#898781",
    productos: "#326fc8",
    servicios: "#eb6834",
    // Single flat hue for the status bar chart (magnitude comparison, not
    // series identity) — same brand blue as the "productos" series, reused
    // under its own name so the two uses don't read as the same concept.
    accent: "#326fc8",
  },
  dark: {
    surface: "#1a1a19",
    grid: "#2c2c2a",
    axis: "#383835",
    textMuted: "#898781",
    productos: "#4a84e0",
    servicios: "#d95926",
    accent: "#4a84e0",
  },
} as const;

const STATUS_ORDER = ["borrador", "enviada", "aprobada", "rechazada", "vencida"] as const;
const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function formatMoney(value: string | number) {
  return `$${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

// ── Small building blocks ────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}

function TileSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-3" />
      <div className="h-7 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[280px] rounded-lg bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-8 bg-zinc-100 dark:bg-zinc-800/60 rounded animate-pulse" />
      ))}
    </div>
  );
}

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
        <AlertCircle className="w-3 h-3" />
        Sin stock
      </span>
    );
  }
  if (qty <= 5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20">
        <AlertTriangle className="w-3 h-3" />
        Stock bajo
      </span>
    );
  }
  return <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{qty} u.</span>;
}

type TooltipColors = { surface: string; grid: string };

// Custom tooltip: value leads (Strong, high-contrast), series name follows;
// a short line-key stands in for a swatch box (see dataviz/interaction.md).
function TimeSeriesTooltip({
  active,
  payload,
  label,
  colors,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; name: string; color: string }>;
  label?: string;
  colors: TooltipColors;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{ background: colors.surface, borderColor: colors.grid }}
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
    >
      <p className="text-zinc-400 dark:text-zinc-500 mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">{entry.value}</span>
          <span className="text-zinc-500 dark:text-zinc-400">{entry.name}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const isAdmin = useSyncExternalStore(
    subscribeAuth,
    () => getRole() === "ADMIN",
    () => false,
  );
  const isDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const colors = isDark ? PALETTE.dark : PALETTE.light;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const token = getToken();
    if (!token) return;
    api.dashboard
      .stats(token)
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar el dashboard"))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Bienvenido al panel de administración.</p>
      </div>
    );
  }

  const statusData = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: stats?.quotes_by_status.find((s) => s.status === status)?.count ?? 0,
  }));
  const hasStatusActivity = statusData.some((d) => d.count > 0);

  const timeSeriesData = (stats?.quotes_last_30_days ?? []).map((d) => ({
    ...d,
    label: formatShortDate(d.date),
  }));
  const hasQuoteActivity = timeSeriesData.some((d) => d.productos > 0 || d.servicios > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Resumen general del negocio.</p>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading || !stats ? (
          Array.from({ length: 5 }).map((_, i) => <TileSkeleton key={i} />)
        ) : (
          <>
            <StatTile icon={Package} label="Productos activos" value={stats.active_products} />
            <StatTile icon={Boxes} label="Insumos activos" value={stats.active_supplies} />
            <StatTile icon={Wallet} label="Valor cotiz. aprobadas" value={formatMoney(stats.approved_quotes_value)} />
            <StatTile icon={CheckCircle2} label="Cotiz. aprobadas" value={stats.approved_quotes_count} />
            <StatTile icon={MessageSquare} label="Consultas pendientes" value={stats.pending_consultations} />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Time series: quotes per day, last 30 days, 2 series → line chart
            with a legend (mandatory for 2+ series) and a shared tooltip. */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Cotizaciones por día</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Últimos 30 días, por tipo de cotización</p>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={timeSeriesData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={colors.grid} strokeDasharray="0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: colors.textMuted }}
                      axisLine={{ stroke: colors.axis }}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      domain={[0, "auto"]}
                      tick={{ fontSize: 11, fill: colors.textMuted }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip content={<TimeSeriesTooltip colors={colors} />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) => <span className="text-zinc-600 dark:text-zinc-300">{value}</span>}
                    />
                    <Line
                      type="monotone"
                      dataKey="productos"
                      name="Productos"
                      stroke={colors.productos}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
                    />
                    <Line
                      type="monotone"
                      dataKey="servicios"
                      name="Servicios"
                      stroke={colors.servicios}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                {!hasQuoteActivity && (
                  <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-zinc-400 dark:text-zinc-500 pointer-events-none">
                    Todavía no hay cotizaciones en este período.
                  </p>
                )}
              </div>

              {/* Table-view twin: every value stays reachable without hovering. */}
              <details className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                <summary className="cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200">
                  Ver datos en tabla
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-zinc-400 dark:text-zinc-500">
                        <th className="py-1 pr-2">Fecha</th>
                        <th className="py-1 pr-2 text-right">Productos</th>
                        <th className="py-1 text-right">Servicios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeSeriesData.map((d) => (
                        <tr key={d.date} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="py-1 pr-2 tabular-nums">{d.label}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{d.productos}</td>
                          <td className="py-1 text-right tabular-nums">{d.servicios}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>

        {/* Status breakdown: this is a magnitude-comparison job (how many
            quotes sit in each status), not an identity/series-telling-apart
            job — per dataviz/choosing-a-form.md that maps to a bar chart
            with ONE flat hue, not a per-bar categorical rainbow (see
            anti-patterns.md: "a value-ramp on nominal categories" is the
            wrong tool here). Category identity comes from the x-axis tick
            labels + the always-visible value-at-cap labels, never from
            color alone. A donut/pie was ruled out per anti-patterns.md —
            comparing 5 close-ish magnitudes is exactly the case pies fail. */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Cotizaciones por estado</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Todas las cotizaciones (productos + servicios)</p>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statusData} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: colors.textMuted }}
                    axisLine={{ stroke: colors.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, "auto"]}
                    tick={{ fontSize: 11, fill: colors.textMuted }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: colors.surface,
                      border: `1px solid ${colors.grid}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: colors.textMuted }}
                    formatter={(value) => [value, "Cotizaciones"]}
                  />
                  <Bar
                    dataKey="count"
                    fill={colors.accent}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    activeBar={{ fillOpacity: 0.85 }}
                    label={{ position: "top", fontSize: 11, fill: colors.textMuted }}
                  />
                </BarChart>
              </ResponsiveContainer>
              {!hasStatusActivity && (
                <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-zinc-400 dark:text-zinc-500 pointer-events-none">
                  Todavía no hay cotizaciones cargadas.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Low stock */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Stock bajo</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Las 5 variantes con menor stock</p>
        {loading ? (
          <TableSkeleton />
        ) : stats && stats.low_stock_variants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-2 pr-4">Producto</th>
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {stats.low_stock_variants.map((v) => (
                  <tr key={v.variant_id}>
                    <td className="py-2 pr-4 text-zinc-900 dark:text-white">{v.product_name}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">{v.sku}</td>
                    <td className="py-2 text-right">
                      <StockBadge qty={v.stock_qty} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">No hay variantes con stock bajo.</p>
        )}
      </div>
    </div>
  );
}
