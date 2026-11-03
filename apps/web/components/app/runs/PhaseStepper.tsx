"use client";

import { Check, Loader2, X } from "lucide-react";
import { FASES, type EstadoFase, type Fase } from "@/lib/runs/consola";
import { cn } from "@/lib/utils";

const TEXTO_ESTADO: Record<EstadoFase, string> = {
  pendiente: "pendiente",
  activo: "en curso",
  ok: "completada",
  error: "con error",
};

function Nodo({ estado }: { estado: EstadoFase }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] transition-colors",
        estado === "pendiente" && "border-border-strong text-fg-dim",
        estado === "activo" && "border-brand text-brand",
        estado === "ok" && "border-brand bg-brand text-primary-fg",
        estado === "error" && "border-s-no-funciona bg-s-no-funciona text-white",
      )}
    >
      {estado === "activo" && <Loader2 className="size-3.5 animate-spin" />}
      {estado === "ok" && <Check className="size-3.5" strokeWidth={3} />}
      {estado === "error" && <X className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

/**
 * Tres nodos (Rastreo → Análisis → Verificación) con línea conectora.
 * Verificación muestra "(n/3)" cuando hubo reintentos.
 */
export function PhaseStepper({
  fases,
  intentos,
  className,
}: {
  fases: Record<Fase, EstadoFase>;
  intentos: number;
  className?: string;
}): React.ReactElement {
  return (
    <ol aria-label="Fases de la corrida" className={cn("flex items-center gap-2 sm:gap-3", className)}>
      {FASES.map((fase, i) => {
        const estado = fases[fase];
        return (
          <li className={cn("flex min-w-0 items-center gap-2 sm:gap-3", i < FASES.length - 1 && "flex-1")} key={fase}>
            <span className="flex min-w-0 items-center gap-2">
              <Nodo estado={estado} />
              <span
                className={cn(
                  "truncate text-xs sm:text-sm",
                  estado === "pendiente" && "text-fg-dim",
                  estado === "activo" && "font-medium text-fg",
                  estado === "ok" && "text-fg-muted",
                  estado === "error" && "font-medium text-s-no-funciona",
                )}
              >
                {fase}
                {fase === "Verificación" && intentos >= 2 && (
                  <span className="ms-1 font-mono text-[11px] text-fg-muted">({Math.min(intentos, 3)}/3)</span>
                )}
                <span className="sr-only"> · {TEXTO_ESTADO[estado]}</span>
              </span>
            </span>
            {i < FASES.length - 1 && (
              <span
                aria-hidden="true"
                className={cn("h-px min-w-4 flex-1 transition-colors", estado === "ok" ? "bg-brand" : "bg-border-strong")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
