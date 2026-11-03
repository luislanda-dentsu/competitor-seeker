import { ChartTable } from "@/components/app/charts/ChartTable";
import { SIGNAL_META } from "@/components/app/signals/signal-meta";
import { SENALES_ORDEN, type PuntoEvolucion } from "@/lib/data/agrupar";
import { fmtFecha, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const LETRA: Record<(typeof SENALES_ORDEN)[number], string> = {
  nuevo: "N",
  confuso: "C",
  "sin-datos": "S",
  "no-funciona": "X",
};

/**
 * Evolución: una fila por corrida con una celda por entrada coloreada por
 * señal (con inicial y aria-label: nunca solo color) y el % con evidencia.
 */
export function SignalStrip({ evolucion }: { evolucion: PuntoEvolucion[] }): React.ReactElement {
  if (evolucion.length === 0) {
    return <p className="py-6 text-center text-sm text-fg-muted">Sin corridas para este competidor.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="Señales por corrida" className="flex flex-col gap-2">
        {evolucion.map((p) => (
          <li
            className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-xs"
            key={p.corridaId}
          >
            <span className="flex flex-col">
              <span className="font-mono tabular-nums text-fg">{fmtFecha(p.fecha)}</span>
              <span className="truncate font-mono text-[10px] text-fg-dim" title={p.corridaId}>
                {p.corridaId}
              </span>
            </span>
            <ul className="flex flex-wrap gap-1">
              {p.senales.map((s, i) => (
                <li
                  aria-label={`${SIGNAL_META[s].label}`}
                  className={cn(
                    "grid size-5 place-items-center rounded-[4px] font-mono text-[10px] font-semibold",
                    SIGNAL_META[s].bg,
                    SIGNAL_META[s].text,
                  )}
                  key={`${p.corridaId}-${i}`}
                  title={SIGNAL_META[s].label}
                >
                  <span aria-hidden="true">{LETRA[s]}</span>
                </li>
              ))}
            </ul>
            <span className="font-mono tabular-nums text-fg-muted">
              {fmtPct(p.pctConEvidencia, { scaled: true })}
              <span className="ms-1 hidden text-fg-dim sm:inline">con evidencia</span>
            </span>
          </li>
        ))}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {SENALES_ORDEN.map((s) => (
          <li className="flex items-center gap-1.5" key={s}>
            <span
              aria-hidden="true"
              className={cn(
                "grid size-4 place-items-center rounded-[3px] font-mono text-[9px] font-semibold",
                SIGNAL_META[s].bg,
                SIGNAL_META[s].text,
              )}
            >
              {LETRA[s]}
            </span>
            {SIGNAL_META[s].label}
          </li>
        ))}
      </ul>
      <ChartTable
        caption="Señales por corrida"
        columnas={["Corrida", "Nuevo", "Confuso", "Sin datos", "No funciona", "% evidencia"]}
        filas={evolucion.map((p) => [
          fmtFecha(p.fecha),
          p.conteo.nuevo,
          p.conteo.confuso,
          p.conteo["sin-datos"],
          p.conteo["no-funciona"],
          fmtPct(p.pctConEvidencia, { scaled: true }),
        ])}
      />
    </div>
  );
}
