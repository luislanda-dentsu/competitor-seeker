"use client";

import { Gauge } from "lucide-react";
import Link from "next/link";
import { Meter, MeterIndicator, MeterTrack } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { tonoPct, useUsoApify, type EstadoUsoApify, type TonoUso } from "@/lib/apify/cliente";
import { fmtFecha } from "@/lib/format";
import { cn } from "@/lib/utils";

const INDICADOR: Record<TonoUso, string> = {
  ok: "bg-series anim-grow-x",
  aviso: "bg-s-confuso anim-grow-x",
  critico: "bg-s-no-funciona anim-grow-x",
};
const TEXTO: Record<TonoUso, string> = {
  ok: "text-fg",
  aviso: "text-s-confuso",
  critico: "text-s-no-funciona",
};
const TRAZO: Record<TonoUso, string> = {
  ok: "stroke-series",
  aviso: "stroke-s-confuso",
  critico: "stroke-s-no-funciona",
};

function fmtPctCorto(pct: number): string {
  return `${Math.round(pct)}%`;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function Fila({ etiqueta, usadoUsd, limiteUsd, pct }: { etiqueta: string; usadoUsd: number; limiteUsd: number; pct: number }): React.ReactElement {
  const tono = tonoPct(pct);
  return (
    <Meter
      aria-label={`${etiqueta}: ${fmtUsd(usadoUsd)} de ${fmtUsd(limiteUsd)} (${fmtPctCorto(pct)})`}
      className="gap-1"
      max={100}
      value={Math.min(100, Math.max(0, pct))}
    >
      <span className="flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">{etiqueta}</span>
        <span className={cn("font-mono tabular-nums", TEXTO[tono])}>{fmtPctCorto(pct)}</span>
      </span>
      <MeterTrack className="h-1.5 rounded-pill bg-card-2">
        <MeterIndicator className={cn("rounded-pill", INDICADOR[tono])} />
      </MeterTrack>
    </Meter>
  );
}

/** Anillo con el % mensual para el sidebar colapsado. */
function Anillo({ pct }: { pct: number }): React.ReactElement {
  const tono = tonoPct(pct);
  const r = 9;
  const circ = 2 * Math.PI * r;
  const lleno = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <span className="relative grid size-7 place-items-center">
      <svg aria-hidden="true" className="absolute inset-0 -rotate-90" viewBox="0 0 24 24">
        <circle className="stroke-card-2" cx="12" cy="12" fill="none" r={r} strokeWidth="2.5" />
        <circle
          className={cn("transition-[stroke-dasharray] duration-500", TRAZO[tono])}
          cx="12"
          cy="12"
          fill="none"
          r={r}
          strokeDasharray={`${lleno} ${circ - lleno}`}
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      </svg>
      <span className={cn("font-mono text-[9px] font-semibold tabular-nums leading-none", TEXTO[tono])}>{Math.round(pct)}</span>
    </span>
  );
}

/** Vista pura: recibe el estado ya cargado (la reutiliza la vista previa de Presupuestos). */
export function UsageMeterView({
  estado,
  collapsed = false,
  collapsible = true,
  className,
}: {
  estado: EstadoUsoApify;
  collapsed?: boolean;
  collapsible?: boolean;
  className?: string;
}): React.ReactElement {
  const { uso, decision } = estado;
  if (!uso) {
    return (
      <SinConfigurar
        className={className}
        collapsed={collapsed}
        collapsible={collapsible}
        detalle={estado.configurado ? (estado.error ?? decision.motivo ?? "sin datos de uso") : "Apify sin configurar"}
      />
    );
  }
  const reinicia = fmtFecha(uso.ciclo.fin.slice(0, 10));
  const resumen = `Apify: hoy ${fmtPctCorto(uso.diario.pct)} · semana ${fmtPctCorto(uso.semanal.pct)} · ciclo ${fmtPctCorto(uso.mensual.pct)} · reinicia ${reinicia}`;
  const expandido = (
    <Link
      aria-label={resumen}
      className={cn(
        "flex flex-col gap-2 rounded-[10px] bg-card-2 px-2.5 py-2 transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
        collapsible && "sb-collapsed:hidden",
        className,
      )}
      href="/ajustes#presupuestos"
    >
      <span className="flex items-center justify-between">
        <span className="t-label">Uso de Apify</span>
        {!decision.habilitado && (
          <span className="rounded-sm bg-s-confuso-soft px-1 font-mono text-[10px] text-s-confuso" title={decision.motivo}>
            pausado
          </span>
        )}
      </span>
      <Fila etiqueta="Hoy" limiteUsd={uso.diario.limiteUsd} pct={uso.diario.pct} usadoUsd={uso.diario.usadoUsd} />
      <Fila etiqueta="Semana" limiteUsd={uso.semanal.limiteUsd} pct={uso.semanal.pct} usadoUsd={uso.semanal.usadoUsd} />
      <Fila etiqueta="Ciclo" limiteUsd={uso.mensual.limiteUsd} pct={uso.mensual.pct} usadoUsd={uso.mensual.usadoUsd} />
      <span className="text-[11px] text-fg-dim">
        {fmtUsd(uso.mensual.usadoUsd)} de {fmtUsd(uso.mensual.limiteUsd)} · reinicia {reinicia}
      </span>
    </Link>
  );
  if (!collapsible) return expandido;
  const colapsado = (
    <Link
      aria-label={resumen}
      className={cn(
        "hidden justify-center rounded-md py-1.5 transition-colors hover:bg-card-2/70 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 sb-collapsed:flex",
        className,
      )}
      href="/ajustes#presupuestos"
    >
      <Anillo pct={uso.mensual.pct} />
    </Link>
  );
  return (
    <>
      {expandido}
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={colapsado} />
          <TooltipPopup side="right">
            <span className="flex flex-col gap-0.5 font-mono text-xs tabular-nums">
              <span>hoy {fmtPctCorto(uso.diario.pct)}</span>
              <span>semana {fmtPctCorto(uso.semanal.pct)}</span>
              <span>ciclo {fmtPctCorto(uso.mensual.pct)}</span>
              <span className="font-sans text-fg-muted">reinicia {reinicia}</span>
            </span>
          </TooltipPopup>
        </Tooltip>
      ) : (
        colapsado
      )}
    </>
  );
}

function SinConfigurar({
  collapsed,
  collapsible,
  className,
  detalle,
}: {
  collapsed: boolean;
  collapsible: boolean;
  className?: string;
  detalle: string;
}): React.ReactElement {
  const link = (
    <Link
      className={cn(
        "flex items-center gap-2.5 rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-fg-muted transition-colors hover:bg-card-2/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
        collapsible && "sb-collapsed:justify-center sb-collapsed:border-transparent sb-collapsed:px-0",
        className,
      )}
      href="/ajustes#apify"
    >
      <Gauge aria-hidden="true" className="size-[18px] shrink-0" />
      <span className={cn("flex min-w-0 flex-col", collapsible && "sb-collapsed:sr-only")}>
        <span className="t-label">Uso de Apify</span>
        <span className="truncate" title={detalle}>
          {detalle}
        </span>
      </span>
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipPopup side="right">{detalle} · ir a Ajustes</TooltipPopup>
    </Tooltip>
  );
}

/**
 * Medidor de uso de Apify del sidebar: hoy / semana / ciclo contra presupuesto.
 * Carga `/api/apify/uso` al montar y cada 5 min. Sin token → enlace a Ajustes.
 */
export function UsageMeter({
  collapsed = false,
  collapsible = true,
  className,
}: {
  collapsed?: boolean;
  /** false en el Sheet móvil: ignora el estado colapsado del sidebar. */
  collapsible?: boolean;
  className?: string;
}): React.ReactElement {
  const { estado, cargando, error } = useUsoApify();
  if (cargando && !estado) {
    return (
      <div aria-busy="true" aria-label="Cargando uso de Apify" className={cn("flex flex-col gap-2 px-2.5 py-2", collapsible && "sb-collapsed:items-center sb-collapsed:px-0", className)}>
        <Skeleton className={cn("h-3 w-20", collapsible && "sb-collapsed:hidden")} />
        <Skeleton className={cn("h-1.5 w-full", collapsible && "sb-collapsed:size-7 sb-collapsed:rounded-full")} />
        <Skeleton className={cn("h-1.5 w-full", collapsible && "sb-collapsed:hidden")} />
      </div>
    );
  }
  if (!estado) {
    return <SinConfigurar className={className} collapsed={collapsed} collapsible={collapsible} detalle={error ?? "Uso no disponible"} />;
  }
  return <UsageMeterView className={className} collapsed={collapsed} collapsible={collapsible} estado={estado} />;
}
