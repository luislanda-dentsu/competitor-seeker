"use client";

import type { Entrada } from "@competitor-seeker/core";
import { ExternalLink } from "lucide-react";
import type { CSSProperties } from "react";
import AnimatedList, { type AnimatedListEntry } from "@/components/bits/AnimatedList";
import { SignalBadge } from "@/components/app/signals/SignalBadge";
import { SignalDot } from "@/components/app/signals/SignalDot";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { GrupoCorrida } from "@/lib/data/agrupar";
import { fmtFecha } from "@/lib/format";

/* AnimatedList pinta "tiles" con sus propias variables; aquí se mapean a los
   tokens del panel para que parezcan filas planas sobre la card. */
const TOKENS = {
  "--al-tile": "transparent",
  "--al-tile-edge": "transparent",
  "--al-tile-highlight": "transparent",
  "--al-tile-shadow": "none",
  "--al-frame": "transparent",
  "--al-ink": "var(--fg)",
  "--al-muted": "var(--fg-muted)",
  "--al-well": "var(--card-2)",
  "--al-ring": "var(--border-strong)",
  "--al-ring-fill": "transparent",
  "--al-hover": "none",
  "--al-press": "none",
  "--al-active": "none",
  "--al-thumb": "var(--border-strong)",
} as CSSProperties;

interface Item extends AnimatedListEntry {
  id: string;
  entrada: Entrada;
  ultima: boolean;
}

function Fila({ entrada: e, ultima }: Pick<Item, "entrada" | "ultima">): React.ReactElement {
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
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
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

function Grupo({ grupo, reducido }: { grupo: GrupoCorrida; reducido: boolean }): React.ReactElement {
  const items: Item[] = grupo.entradas.map((e, i) => ({
    id: e.id,
    title: e.movimiento,
    entrada: e,
    ultima: i === grupo.entradas.length - 1,
  }));
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
      <AnimatedList
        animation={reducido ? "none" : "fade"}
        animateOnce
        displayScrollbar={false}
        enableArrowNavigation={false}
        frame={false}
        gap={6}
        initialSelectedIndex={-1}
        itemClassName="cursor-default!"
        items={items}
        maxHeight="none"
        radius={8}
        renderItem={(item) => {
          const it = item as Item;
          return <Fila entrada={it.entrada} ultima={it.ultima} />;
        }}
        selectOnHover={false}
        showGradients={false}
        stagger={0.04}
        style={TOKENS}
        width="100%"
      />
    </section>
  );
}

/**
 * Histórico vertical agrupado por corrida. Cada grupo es un AnimatedList
 * (React Bits) con las variables mapeadas a nuestros tokens; con
 * prefers-reduced-motion la animación de entrada se desactiva.
 */
export function EntryTimeline({ grupos }: { grupos: GrupoCorrida[] }): React.ReactElement {
  const reducido = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (grupos.length === 0) {
    return <p className="py-6 text-center text-sm text-fg-muted">Ninguna entrada coincide con el filtro.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <Grupo grupo={g} key={g.corridaId} reducido={reducido} />
      ))}
    </div>
  );
}
