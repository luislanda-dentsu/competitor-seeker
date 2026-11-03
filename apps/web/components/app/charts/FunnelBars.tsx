import { ChartTable } from "@/components/app/charts/ChartTable";
import { fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface EtapaEmbudo {
  label: string;
  n: number;
  /** 0–100: altura de las barras. */
  pct: number;
}

const BARRAS_POR_ETAPA = 10;

/**
 * "Cadena de evidencia": por etapa, N barras verticales finas (2px, gap 3px)
 * con altura proporcional; la primera en acento de marca y el resto en
 * borde fuerte, como en la referencia.
 */
export function FunnelBars({ etapas }: { etapas: EtapaEmbudo[] }): React.ReactElement {
  return (
    <div className="flex h-full flex-col gap-4">
      <ol
        aria-label="Cadena de evidencia por etapa"
        className="grid flex-1 grid-cols-4 gap-3"
      >
        {etapas.map((e, idx) => {
          const h = Math.max(4, Math.min(100, e.pct));
          return (
            <li className="flex min-w-0 flex-col gap-2" key={e.label}>
              <div
                aria-label={`${e.label}: ${fmtInt(e.n)} (${fmtPct(e.pct, { scaled: true })})`}
                className="flex h-28 items-end gap-[3px]"
                role="img"
              >
                {Array.from({ length: BARRAS_POR_ETAPA }, (_, i) => (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-0.5 rounded-t-[1px]",
                      i === 0 ? "bg-brand" : "bg-border-strong",
                    )}
                    key={i}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-sm tabular-nums text-fg">
                  {fmtPct(e.pct, { scaled: true })}
                </span>
                <span className="truncate text-xs text-fg-muted" title={e.label}>
                  {idx + 1}. {e.label}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-fg-dim">
                  {fmtInt(e.n)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <ChartTable
        caption="Cadena de evidencia"
        columnas={["Etapa", "N", "%"]}
        filas={etapas.map((e) => [e.label, e.n, fmtPct(e.pct, { scaled: true })])}
      />
    </div>
  );
}
