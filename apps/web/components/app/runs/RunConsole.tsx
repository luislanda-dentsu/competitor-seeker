"use client";

import { ArrowDown, Square } from "lucide-react";
import { useEffect, useRef, useState, type UIEvent } from "react";
import { Button } from "@/components/ui/button";
import { PhaseStepper } from "@/components/app/runs/PhaseStepper";
import { fmtDur, fmtFecha } from "@/lib/format";
import { horaDe, type EstadoConsola, type LineaConsola } from "@/lib/runs/consola";
import type { ConexionSSE } from "@/lib/use-sse";
import { cn } from "@/lib/utils";
import "./run-console.css";

function colorPrefijo(l: LineaConsola): string {
  switch (l.tipo) {
    case "fase":
      return "text-brand";
    case "denegado":
      return "text-s-no-funciona";
    case "tool":
      return "text-chart-6";
    case "agente":
      return "text-s-confuso";
    case "fin":
      return "text-fg";
    case "info":
      return l.prefijo === "[error]" || l.prefijo === "[stderr]" ? "text-s-no-funciona" : "text-fg-dim";
    default:
      return "text-fg-muted";
  }
}

const TEXTO_CONEXION: Record<ConexionSSE, string> = {
  inactiva: "",
  conectando: "conectando…",
  conectada: "en vivo",
  reconectando: "reconectando…",
  cerrada: "terminada",
};

export interface RunConsoleViewProps {
  marca: string;
  /** AAAA-MM-DD. */
  fecha: string;
  consola: EstadoConsola;
  /** Texto del cronómetro / duración. */
  tiempo: string;
  conexion?: ConexionSSE;
  onCancelar?: () => void;
  cancelando?: boolean;
  className?: string;
}

/** Isla oscura: cabecera · stepper · lista de eventos con autoscroll. */
export function RunConsoleView({ marca, fecha, consola, tiempo, conexion = "inactiva", onCancelar, cancelando, className }: RunConsoleViewProps): React.ReactElement {
  const listaRef = useRef<HTMLOListElement>(null);
  const [seguir, setSeguir] = useState(true);
  const total = consola.lineas.length;

  useEffect(() => {
    const el = listaRef.current;
    if (!el || !seguir) return;
    el.scrollTop = el.scrollHeight;
  }, [total, seguir]);

  const onScroll = (e: UIEvent<HTMLOListElement>) => {
    const el = e.currentTarget;
    const alFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (alFinal !== seguir) setSeguir(alFinal);
  };

  const viva = conexion === "conectada" || conexion === "conectando" || conexion === "reconectando";

  return (
    <section
      aria-label={`Consola de la corrida de ${marca}`}
      className={cn("run-console overflow-hidden rounded-lg border border-border bg-surface text-fg shadow-xs", className)}
      data-theme="dark"
    >
      <header className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2">
        <span className="font-medium">{marca}</span>
        <span aria-hidden="true" className="text-fg-dim">·</span>
        <span className="text-sm text-fg-muted">{fmtFecha(fecha)}</span>
        <span aria-hidden="true" className="text-fg-dim">·</span>
        <span aria-label="Tiempo transcurrido" className="font-mono text-sm tabular-nums text-fg">
          {tiempo}
        </span>
        {conexion !== "inactiva" && (
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                conexion === "conectada" && "bg-brand",
                conexion === "reconectando" && "bg-s-confuso",
                conexion === "conectando" && "bg-fg-dim",
                conexion === "cerrada" && "bg-fg-dim",
              )}
            />
            {TEXTO_CONEXION[conexion]}
          </span>
        )}
        {onCancelar && viva && (
          <Button className="ms-auto" loading={cancelando} onClick={onCancelar} size="sm" variant="destructive-outline">
            <Square aria-hidden="true" />
            Cancelar
          </Button>
        )}
      </header>

      <div className="border-b border-border px-4 py-3">
        <PhaseStepper fases={consola.fases} intentos={consola.intentosVerificacion} />
      </div>

      <div className="relative">
        <ol
          aria-label="Eventos de la corrida"
          aria-live="polite"
          aria-relevant="additions"
          className="h-72 overflow-y-auto overscroll-contain px-4 py-3 font-code text-xs leading-5 sm:h-80"
          onScroll={onScroll}
          ref={listaRef}
        >
          {total === 0 && <li className="text-fg-dim">Esperando eventos…</li>}
          {consola.lineas.map((l, i) => (
            <li className="flex gap-2" key={i}>
              <span className="shrink-0 tabular-nums text-fg-dim">{l.ts > 0 ? horaDe(l.ts) : "—"}</span>
              <span className={cn("shrink-0", colorPrefijo(l))}>{l.prefijo}</span>
              <span className="min-w-0 whitespace-pre-wrap break-words text-fg-muted">{l.texto}</span>
            </li>
          ))}
        </ol>
        {!seguir && total > 0 && (
          <Button
            className="absolute right-3 bottom-3 shadow-float"
            onClick={() => {
              setSeguir(true);
              const el = listaRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
            size="xs"
            variant="secondary"
          >
            <ArrowDown aria-hidden="true" />
            seguir
          </Button>
        )}
      </div>
    </section>
  );
}

/** Cronómetro: desde `inicio` (ISO) hasta ahora, o `duracionMs` fija si ya terminó. */
export function useCronometro(inicio: string, duracionMs: number | undefined, activo: boolean): string {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activo]);
  if (duracionMs !== undefined) return fmtDur(duracionMs);
  const ms = Math.max(0, ahora - Date.parse(inicio));
  return fmtDur(ms);
}
