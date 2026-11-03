import { ChartTable } from "@/components/app/charts/ChartTable";
import { Gauge } from "@/components/app/charts/Gauge";
import { SIGNAL_META } from "@/components/app/signals/signal-meta";
import { SENALES_ORDEN, type ConteoSenales } from "@/lib/data/agrupar";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Barra apilada horizontal con 4 segmentos (uno por señal, separados por
 * 2px de superficie), leyenda de puntos con % en mono y gauge "% con
 * evidencia" (entradas con señal distinta de sin-datos).
 */
export function SignalDistribution({
  conteo,
  pctConEvidencia,
}: {
  conteo: ConteoSenales;
  pctConEvidencia: number;
}): React.ReactElement {
  const total = SENALES_ORDEN.reduce((acc, s) => acc + conteo[s], 0);
  const segmentos = SENALES_ORDEN.map((s) => ({
    senal: s,
    n: conteo[s],
    pct: total === 0 ? 0 : (conteo[s] / total) * 100,
  }));
  return (
    <div className="flex h-full flex-col gap-5">
      <div
        aria-label={`Distribución de ${total} entradas por señal`}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-pill bg-card-2"
        role="img"
      >
        {segmentos
          .filter((s) => s.n > 0)
          .map((s) => (
            <span
              className={cn("h-full", SIGNAL_META[s.senal].dot)}
              key={s.senal}
              style={{ width: `${s.pct}%` }}
              title={`${SIGNAL_META[s.senal].label}: ${s.n}`}
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {segmentos.map((s) => (
          <li className="flex items-center justify-between gap-2" key={s.senal}>
            <span className="flex min-w-0 items-center gap-1.5 text-fg-muted">
              <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", SIGNAL_META[s.senal].dot)} />
              <span className="truncate">{SIGNAL_META[s.senal].label}</span>
            </span>
            <span className="font-mono tabular-nums text-fg">
              {fmtPct(s.pct, { scaled: true })}
              <span className="text-fg-dim"> · {s.n}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex justify-center border-t border-border pt-4">
        <Gauge label="% con evidencia" valor={pctConEvidencia} />
      </div>
      <ChartTable
        caption="Entradas por señal"
        columnas={["Señal", "Entradas", "%"]}
        filas={segmentos.map((s) => [SIGNAL_META[s.senal].label, s.n, fmtPct(s.pct, { scaled: true })])}
      />
    </div>
  );
}
