import type { Entrada } from "@competitor-seeker/core";
import { ExternalLink } from "lucide-react";
import type { CSSProperties } from "react";
import { SignalBadge } from "@/components/app/signals/SignalBadge";
import { SignalDot } from "@/components/app/signals/SignalDot";
import type { GrupoCorrida } from "@/lib/data/agrupar";
import { fmtFecha } from "@/lib/format";

function Fila({ entrada: e, ultima }: { entrada: Entrada; ultima: boolean }): React.ReactElement {
  return (
    <article className="relative flex w-full gap-3 ps-1">
      {/* raíl: línea punteada + punto de señal */}
      <div aria-hidden="true" className="relative flex w-3 shrink-0 justify-center">
        {!ultima && (
          <span className="absolute top-3 bottom-[-18px] border-s border-dotted border-border-strong" />
        )}
        <span className="relative mt-1.5 grid size-3 place-items-center rounded-full bg-card">
          <SignalDot senal={e.senal} size="default" />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <time className="font-mono text-xs tabular-nums text-fg-muted" dateTime={e.fecha}>
            {fmtFecha(e.fecha)}
          </time>
          <SignalBadge dot={false} senal={e.senal} size="sm" />
          {e.fuentes && e.fuentes.length > 0 && (
            <span className="font-mono text-[10px] text-fg-dim">
              {e.fuentes.join(" · ")}
            </span>
          )}
        </div>
        <p className="whitespace-normal text-sm leading-snug text-fg">{e.movimiento}</p>
        <p className="whitespace-normal text-xs leading-snug text-fg-muted">
          <span className="font-medium text-fg-dim">Lectura:</span> {e.lectura}
        </p>
        {e.evidencia && e.evidencia.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {e.evidencia.map((url) => (
              <li key={url}>
                <a
                  className="inline-flex max-w-[28ch] items-center gap-1 truncate font-mono text-[11px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                  href={url}
                  rel="noreferrer noopener"
                  target="_blank"
                  title={url}
                >
                  <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
                  {url.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function Grupo({ grupo }: { grupo: GrupoCorrida }): React.ReactElement {
  const c = grupo.corrida;
  const estado = c
    ? c.modo === "migrada"
      ? "migrada"
      : c.verificado
        ? "verificada"
        : c.estado
    : "sin archivo de corrida";
  return (
    <section aria-label={`Corrida ${grupo.corridaId}`} className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono tabular-nums text-fg">{fmtFecha(grupo.fecha)}</span>
        <span className="rounded-pill bg-card-2 px-2 py-0.5 font-mono text-[11px] text-fg-muted">
          {grupo.corridaId}
        </span>
        <span className="text-fg-dim">
          {estado} · {grupo.entradas.length} {grupo.entradas.length === 1 ? "entrada" : "entradas"}
        </span>
      </header>
      <ol className="cs-escalonado flex flex-col gap-1.5">
        {grupo.entradas.map((e, i) => (
          <li key={e.id} style={{ "--i": i } as CSSProperties}>
            <Fila entrada={e} ultima={i === grupo.entradas.length - 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Histórico vertical agrupado por corrida. Cada grupo es una lista `<ol>`
 * semántica (los artículos con enlaces quedan accesibles) con entrada
 * escalonada en CSS puro (`.cs-escalonado` en globals.css): la animación va
 * de 0 a 1 y termina visible aunque no corra JS, y se desactiva con
 * prefers-reduced-motion.
 */
export function EntryTimeline({ grupos }: { grupos: GrupoCorrida[] }): React.ReactElement {
  if (grupos.length === 0) {
    return <p className="py-6 text-center text-sm text-fg-muted">Ninguna entrada coincide con el filtro.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <Grupo grupo={g} key={g.corridaId} />
      ))}
    </div>
  );
}
