import type { PuntoSerie } from "@competitor-seeker/core";
import Link from "next/link";
import { SIGNAL_META } from "@/components/app/signals/signal-meta";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtFecha } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEGMENTOS = [
  { key: "nuevo", senal: "nuevo" },
  { key: "confuso", senal: "confuso" },
  { key: "sinDatos", senal: "sin-datos" },
  { key: "noFunciona", senal: "no-funciona" },
] as const;

function MiniStack({ p }: { p: PuntoSerie }): React.ReactElement {
  const total = p.nuevo + p.confuso + p.sinDatos + p.noFunciona;
  return (
    <span
      aria-hidden="true"
      className="flex h-1.5 w-16 gap-px overflow-hidden rounded-pill bg-card-2"
    >
      {SEGMENTOS.filter((s) => p[s.key] > 0).map((s) => (
        <span
          className={cn("h-full", SIGNAL_META[s.senal].dot)}
          key={s.key}
          style={{ width: `${total === 0 ? 0 : (p[s.key] / total) * 100}%` }}
        />
      ))}
    </span>
  );
}

function resumen(p: PuntoSerie): string {
  return SEGMENTOS.filter((s) => p[s.key] > 0)
    .map((s) => `${p[s.key]} ${SIGNAL_META[s.senal].label.toLowerCase()}`)
    .join(" · ");
}

/**
 * Línea de tiempo horizontal de corridas: un punto por corrida (orden
 * cronológico) con mini-stack de señales y tooltip; cada punto enlaza a
 * /corridas.
 */
export function RunTimeline({ serie }: { serie: PuntoSerie[] }): React.ReactElement {
  if (serie.length === 0) {
    return <p className="text-sm text-fg-muted">Todavía no hay corridas registradas.</p>;
  }
  return (
    <div className="relative overflow-x-auto">
      <ol
        aria-label="Corridas registradas"
        className="relative flex min-w-max items-start gap-10 px-2 pt-2 pb-1 before:absolute before:top-[13px] before:right-2 before:left-2 before:border-t before:border-dashed before:border-border-strong"
      >
        {serie.map((p, i) => {
          const ultima = i === serie.length - 1;
          const etiqueta = `Corrida ${fmtFecha(p.fecha)}: ${resumen(p) || "sin entradas"}`;
          return (
            <li className="relative flex flex-col items-center gap-2" key={p.corridaId}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      aria-label={etiqueta}
                      className="group flex flex-col items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                      href="/corridas"
                    />
                  }
                >
                  <span
                    className={cn(
                      "relative grid size-3 place-items-center rounded-full border-2 border-brand bg-surface transition-transform group-hover:scale-125",
                      ultima && "bg-brand",
                    )}
                  />
                  <span className="font-mono text-[11px] tabular-nums text-fg-muted group-hover:text-fg">
                    {fmtFecha(p.fecha)}
                  </span>
                  <MiniStack p={p} />
                </TooltipTrigger>
                <TooltipPopup>
                  <div className="font-mono">
                    <div className="text-[10px] text-fg-dim">{p.corridaId}</div>
                    <div>{resumen(p) || "sin entradas"}</div>
                  </div>
                </TooltipPopup>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
