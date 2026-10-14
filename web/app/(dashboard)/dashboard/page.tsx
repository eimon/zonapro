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
import { formatMoney } from "@/lib/format";

// Categorical palette anchored to the brand accent (#326fc8 — see
// api/core/branding.py's ACCENT_COLOR and Tailwind's `brand-blue`), validated
// with the dataviz skill's validator against both surfaces:
//   node validate_palette.js "#326fc8,#eb6834,#1baf7a,#eda100,#e87ba4,#008300,#4a3aa7,#e34948" --mode light
//   node validate_palette.js "#4a84e0,#d95926,#199e70,#c98500,#d55181,#008300,#9085e9,#e66767" --mode dark
// Both PASS all hard gates (worst adjacent CVD 9.1 light / 8.4 dark,
// normal-vision 19.6 light / 19.3 dark). Slots 1-3 map to the three quote
// types (productos, servicios, construccion) in both charts.
const PALETTE = {
  light: {
    surface: "#fcfcfb",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    textMuted: "#898781",
    productos: "#326fc8",
    servicios: "#eb6834",
    construccion: "#1baf7a",
  },
  dark: {
    surface: "#1a1a19",
    grid: "#2c2c2a",
    axis: "#383835",
    textMuted: "#898781",
    productos: "#4a84e0",
    servicios: "#d95926",
    construccion: "#199e70",
  },
} as const;

// One series per quote type; same order and colors in every chart.
const QUOTE_TYPE_SERIES = [
  { key: "productos", label: "Productos" },
  { key: "servicios", label: "Servicios" },
  { key: "construccion", label: "Construcción" },
] as const;

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

// ── Small building blocks ────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  breakdown,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  breakdown?: { label: string; value: string | number }[];
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{value}</p>
      {breakdown && (
        <dl className="mt-3 space-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-2">
          {breakdown.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
              <dt className="text-zinc-500 dark:text-zinc-400">{row.label}</dt>
              <dd className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
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

// ── Period ────────────────────────────────────────────────────────────────────

// Applies to quote-based figures only (approved totals by approval date,
// quotes by status by creation date). Bounds are local-time midnights sent as
// ISO datetimes; `until` is exclusive.
const PERIOD_OPTIONS = [
  { value: "all", label: "Total" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "this_year", label: "Este año" },
  { value: "custom", label: "Personalizado" },
] as const;

type PeriodPreset = (typeof PERIOD_OPTIONS)[number]["value"];
type Period = { since?: string; until?: string };

function parseDateInput(value: string): Date | null {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

// Returns null while a custom range is incomplete or inverted.
function resolvePeriod(preset: PeriodPreset, customFrom: string, customTo: string): Period | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  switch (preset) {
    case "all":
      return {};
    case "this_month":
      return { since: new Date(today.getFullYear(), today.getMonth(), 1).toISOString() };
    case "last_month":
      return {
        since: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString(),
        until: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
      };
    case "last_30_days":
      return {
        since: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29).toISOString(),
        until: tomorrow.toISOString(),
      };
    case "this_year":
      return { since: new Date(today.getFullYear(), 0, 1).toISOString() };
    case "custom": {
      const from = parseDateInput(customFrom);
      const to = parseDateInput(customTo);
      if (!from || !to || from > to) return null;
      const untilDay = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
      return { since: from.toISOString(), until: untilDay.toISOString() };
    }
  }
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

  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const period = resolvePeriod(preset, customFrom, customTo);
  const periodKey = period ? `${period.since ?? ""}|${period.until ?? ""}` : null;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  // Key of the period the current stats/error belong to; loading is derived
  // from it so changing the period never sets state synchronously in an effect.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = periodKey !== null && loadedKey !== periodKey;

  useEffect(() => {
    if (!isAdmin || periodKey === null) return;
    const token = getToken();
    if (!token) return;
    const [since, until] = periodKey.split("|");
    let cancelled = false;
    api.dashboard
      .stats(token, { since: since || undefined, until: until || undefined })
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar el dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(periodKey);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, periodKey]);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Bienvenido al panel de administración.</p>
      </div>
    );
  }

  const statusData = STATUS_ORDER.map((status) => {
    const row = stats?.quotes_by_status.find((s) => s.status === status);
    return {
      status,
      label: STATUS_LABELS[status],
      count: row?.count ?? 0,
      productos: row?.productos ?? 0,
      servicios: row?.servicios ?? 0,
      construccion: row?.construccion ?? 0,
    };
  });
  const hasStatusActivity = statusData.some((d) => d.count > 0);

  const timeSeriesData = (stats?.quotes_last_30_days ?? []).map((d) => ({
    ...d,
    label: formatShortDate(d.date),
  }));
  const hasQuoteActivity = timeSeriesData.some(
    (d) => d.productos > 0 || d.servicios > 0 || d.construccion > 0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Resumen general del negocio.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Período
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as PeriodPreset)}
              className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-white"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Desde
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Hasta
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-white"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {preset === "custom" && period === null && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Elegí una fecha de inicio y una de fin para aplicar el período.
        </p>
      )}

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {loading || !stats ? (
          Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} />)
        ) : (
          <>
            <StatTile icon={Package} label="Productos activos" value={stats.active_products} />
            <StatTile icon={Boxes} label="Insumos activos" value={stats.active_supplies} />
            {/* Never summed across currencies — one tile per currency. */}
            <StatTile
              icon={Wallet}
              label="Cotiz. aprobadas (ARS)"
              value={formatMoney(stats.approved_quotes_value.ARS, "ARS")}
              breakdown={QUOTE_TYPE_SERIES.map((s) => ({
                label: s.label,
                value: formatMoney(stats.approved_quotes_by_type[s.key].value.ARS, "ARS"),
              }))}
            />
            <StatTile
              icon={Wallet}
              label="Cotiz. aprobadas (USD)"
              value={formatMoney(stats.approved_quotes_value.USD, "USD")}
              breakdown={QUOTE_TYPE_SERIES.map((s) => ({
                label: s.label,
                value: formatMoney(stats.approved_quotes_by_type[s.key].value.USD, "USD"),
              }))}
            />
            <StatTile
              icon={CheckCircle2}
              label="Cotiz. aprobadas"
              value={stats.approved_quotes_count}
              breakdown={QUOTE_TYPE_SERIES.map((s) => ({
                label: s.label,
                value: stats.approved_quotes_by_type[s.key].count,
              }))}
            />
            <StatTile icon={MessageSquare} label="Consultas pendientes" value={stats.pending_consultations} />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Time series: quotes per day, last 30 days, 3 series → line chart
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
                  <LineChart data={timeSeriesData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                      width={32}
                    />
                    <Tooltip content={<TimeSeriesTooltip colors={colors} />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) => <span className="text-zinc-600 dark:text-zinc-300">{value}</span>}
                    />
                    {QUOTE_TYPE_SERIES.map((s) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={colors[s.key]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
                      />
                    ))}
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
                        {QUOTE_TYPE_SERIES.map((s) => (
                          <th key={s.key} className="py-1 pl-2 text-right">{s.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSeriesData.map((d) => (
                        <tr key={d.date} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="py-1 pr-2 tabular-nums">{d.label}</td>
                          {QUOTE_TYPE_SERIES.map((s) => (
                            <td key={s.key} className="py-1 pl-2 text-right tabular-nums">{d[s.key]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>

        {/* Status breakdown by quote type: grouped bars (one bar per type
            within each status), colored with the same series palette as the
            time chart so a type reads the same everywhere. Grouped instead
            of stacked so each type's count is compared from a shared
            baseline; the legend + per-bar value labels keep identity from
            relying on color alone. */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Cotizaciones por estado</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
            {preset === "all" ? "Todas las cotizaciones" : "Creadas en el período"}, por tipo
          </p>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statusData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
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
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: colors.surface,
                      border: `1px solid ${colors.grid}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: colors.textMuted }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => <span className="text-zinc-600 dark:text-zinc-300">{value}</span>}
                  />
                  {QUOTE_TYPE_SERIES.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={colors[s.key]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={16}
                      activeBar={{ fillOpacity: 0.85 }}
                      label={{ position: "top", fontSize: 10, fill: colors.textMuted }}
                    />
                  ))}
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
