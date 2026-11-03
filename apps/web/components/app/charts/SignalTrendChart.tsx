"use client";

import type { PuntoSerie } from "@competitor-seeker/core";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTable } from "@/components/app/charts/ChartTable";
import { SIGNAL_META, type Senal } from "@/components/app/signals/signal-meta";
import { fmtFecha } from "@/lib/format";

interface SerieDef {
  key: keyof Pick<PuntoSerie, "nuevo" | "confuso" | "sinDatos" | "noFunciona">;
  senal: Senal;
  color: string;
  /** Trazo distinto por serie: la identidad nunca depende solo del color. */
  dash?: string;
}

const SERIES: readonly SerieDef[] = [
  { key: "nuevo", senal: "nuevo", color: "var(--chart-1)" },
  { key: "confuso", senal: "confuso", color: "var(--s-confuso)", dash: "5 3" },
  { key: "sinDatos", senal: "sin-datos", color: "var(--s-sin-datos)", dash: "1 3" },
  { key: "noFunciona", senal: "no-funciona", color: "var(--s-no-funciona)", dash: "8 3 2 3" },
];

interface TooltipItem {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipItem[];
  label?: string | number;
}): React.ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;
  const punto = payload[0] as { payload?: PuntoSerie } | undefined;
  const corridaId = punto?.payload?.corridaId;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 font-mono text-xs text-fg shadow-float">
      <div className="mb-1 font-medium">{fmtFecha(String(label))}</div>
      {corridaId && <div className="mb-1.5 text-[10px] text-fg-dim">{corridaId}</div>}
      <ul className="flex flex-col gap-0.5">
        {SERIES.map((s) => {
          const item = payload.find((p) => p.dataKey === s.key);
          return (
            <li className="flex items-center justify-between gap-4" key={s.key}>
              <span className="flex items-center gap-1.5 text-fg-muted">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ background: s.color }}
                />
                {SIGNAL_META[s.senal].label}
              </span>
              <span className="tabular-nums">{item?.value ?? 0}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Tendencia de señales por corrida: área `nuevo` con degradado de marca y
 * líneas finas para confuso / sin-datos / no-funciona. Con una sola corrida
 * se muestran los puntos y una nota.
 */
export function SignalTrendChart({ serie }: { serie: PuntoSerie[] }): React.ReactElement {
  const unaSola = serie.length < 2;
  const datos = serie.map((p) => ({ ...p }));
  return (
    <figure aria-label="Tendencia de señales por corrida" className="flex flex-col gap-3">
      <div className="h-56 w-full">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart
            accessibilityLayer
            data={datos}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <defs>
              <linearGradient id="cs-area-nuevo" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="fecha"
              fontFamily="var(--font-mono)"
              fontSize={11}
              stroke="var(--fg-dim)"
              tickFormatter={(v: string) => fmtFecha(v)}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              fontFamily="var(--font-mono)"
              fontSize={11}
              stroke="var(--fg-dim)"
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: "var(--border-strong)", strokeDasharray: "2 4" }}
            />
            <Area
              activeDot={{ r: 4, strokeWidth: 0 }}
              dataKey="nuevo"
              dot={unaSola ? { r: 4, strokeWidth: 0, fill: "var(--chart-1)" } : false}
              fill="url(#cs-area-nuevo)"
              isAnimationActive={false}
              name="Nuevo"
              stroke="var(--brand-line)"
              strokeWidth={2}
              type="monotone"
            />
            {SERIES.filter((s) => s.key !== "nuevo").map((s) => (
              <Line
                activeDot={{ r: 3, strokeWidth: 0 }}
                dataKey={s.key}
                dot={unaSola ? { r: 3, strokeWidth: 0, fill: s.color } : false}
                isAnimationActive={false}
                key={s.key}
                name={SIGNAL_META[s.senal].label}
                stroke={s.color}
                strokeDasharray={s.dash}
                strokeWidth={1.25}
                type="monotone"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          {SERIES.map((s) => (
            <li className="flex items-center gap-1.5" key={s.key}>
              <svg aria-hidden="true" className="h-2 w-5" viewBox="0 0 20 8">
                <line
                  stroke={s.color}
                  strokeDasharray={s.dash}
                  strokeWidth={s.key === "nuevo" ? 3 : 1.5}
                  x1="0"
                  x2="20"
                  y1="4"
                  y2="4"
                />
              </svg>
              {SIGNAL_META[s.senal].label}
            </li>
          ))}
        </ul>
        {unaSola && (
          <p className="text-xs text-fg-dim">
            Se dibuja la tendencia a partir de 2 corridas.
          </p>
        )}
      </div>

      <ChartTable
        caption="Conteo de señales por corrida"
        columnas={["Corrida", "Nuevo", "Confuso", "Sin datos", "No funciona"]}
        filas={serie.map((p) => [fmtFecha(p.fecha), p.nuevo, p.confuso, p.sinDatos, p.noFunciona])}
      />
    </figure>
  );
}
