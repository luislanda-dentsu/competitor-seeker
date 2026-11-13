"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EstimacionHistoricaUi, VentanaUi } from "@/lib/runs/tipos";

export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Estimación de la API para la ventana (null mientras no hay ventana válida o está cargando). */
export function useEstimacionHistorica(
  marca: string | undefined,
  ventana: VentanaUi,
  activa: boolean,
): { estimacion: EstimacionHistoricaUi | null; error: string | null; cargando: boolean } {
  const [estado, setEstado] = useState<{ clave: string; estimacion: EstimacionHistoricaUi | null; error: string | null }>({
    clave: "",
    estimacion: null,
    error: null,
  });
  const lista = activa && !!marca && ISO.test(ventana.desde) && ISO.test(ventana.hasta);
  const clave = lista ? `${marca}|${ventana.desde}|${ventana.hasta}` : "";

  useEffect(() => {
    if (!clave) return;
    const ctrl = new AbortController();
    const [m, desde, hasta] = clave.split("|");
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ marca: m!, desde: desde!, hasta: hasta! });
      fetch(`/api/corridas/estimacion?${qs.toString()}`, { cache: "no-store", signal: ctrl.signal })
        .then(async (r) => {
          const cuerpo = (await r.json().catch(() => ({}))) as EstimacionHistoricaUi & { error?: string };
          setEstado(r.ok ? { clave, estimacion: cuerpo, error: null } : { clave, estimacion: null, error: cuerpo.error ?? `Error ${r.status}` });
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setEstado({ clave, estimacion: null, error: (e as Error).message });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [clave]);

  const vigente = clave !== "" && estado.clave === clave;
  return { estimacion: vigente ? estado.estimacion : null, error: vigente ? estado.error : null, cargando: clave !== "" && !vigente };
}

/** Campos «desde / hasta» de la corrida histórica. */
export function VentanaFields({
  ventana,
  onChange,
  max,
  disabled,
}: {
  ventana: VentanaUi;
  onChange: (v: VentanaUi) => void;
  /** Último día elegible (ayer). */
  max: string;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label="Desde"
        disabled={disabled}
        max={ventana.hasta || max}
        nativeInput
        onChange={(e) => onChange({ ...ventana, desde: e.currentTarget.value })}
        size="sm"
        type="date"
        value={ventana.desde}
      />
      <span aria-hidden="true" className="text-fg-muted">
        →
      </span>
      <Input
        aria-label="Hasta"
        disabled={disabled}
        max={max}
        min={ventana.desde || undefined}
        nativeInput
        onChange={(e) => onChange({ ...ventana, hasta: e.currentTarget.value })}
        size="sm"
        type="date"
        value={ventana.hasta}
      />
    </div>
  );
}

/** Confirmación de coste antes de lanzar una corrida histórica. */
export function ConfirmHistoricaDialog({
  open,
  onOpenChange,
  marcaNombre,
  ventana,
  estimacion,
  conApify,
  lanzando,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marcaNombre: string;
  ventana: VentanaUi;
  estimacion: EstimacionHistoricaUi | null;
  conApify: boolean;
  lanzando: boolean;
  onConfirmar: () => void;
}): React.ReactElement {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Corrida de periodo pasado</AlertDialogTitle>
          <AlertDialogDescription>
            {marcaNombre} · del <span className="font-mono tabular-nums">{ventana.desde}</span> al{" "}
            <span className="font-mono tabular-nums">{ventana.hasta}</span>. El navegador localiza los posts de esa ventana y Apify
            trae solo esos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3 px-6 pb-4 text-sm">
          {conApify && estimacion ? (
            <>
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
                <dt className="text-fg-muted">Posts estimados en la ventana</dt>
                <dd className="font-mono tabular-nums text-fg">≈ {estimacion.postsEstimados}</dd>
                <dt className="text-fg-muted">Coste estimado</dt>
                <dd className="font-mono tabular-nums text-fg">{fmtUsd(estimacion.costeEstimadoUsd)}</dd>
                <dt className="text-fg-muted">Coste máximo (tope de {estimacion.topePosts} posts)</dt>
                <dd className="font-mono tabular-nums text-fg">{fmtUsd(estimacion.costeMaximoUsd)}</dd>
              </dl>
              {estimacion.limitadoPorPresupuesto && (
                <p className="text-xs text-s-confuso">
                  El tope se bajó a {estimacion.topePosts} posts para no pasar del presupuesto mensual restante
                  {estimacion.restanteMensualUsd !== null ? ` (${fmtUsd(estimacion.restanteMensualUsd)})` : ""}: algunos posts de la
                  ventana pueden quedar sin cifras.
                </p>
              )}
              {estimacion.competidores.some((c) => !c.observada) && (
                <p className="text-xs text-fg-muted">
                  Sin historial de Apify para{" "}
                  {estimacion.competidores
                    .filter((c) => !c.observada)
                    .map((c) => c.competidor)
                    .join(", ")}
                  : se supone ~{estimacion.competidores.find((c) => !c.observada)?.cadencia} posts al día.
                </p>
              )}
              <p className="text-xs text-fg-muted">
                Las cifras son las de hoy (acumuladas desde la publicación). No se consultan seguidores. Si el navegador no tiene
                sesión de Instagram, la corrida sigue solo con web y no gasta Apify.
              </p>
            </>
          ) : (
            <p className="text-fg-muted">Sin Apify: tendrás lo cualitativo (Instagram y web) pero no likes, comentarios ni vistas.</p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>Cancelar</AlertDialogClose>
          <Button loading={lanzando} onClick={onConfirmar}>
            {conApify && estimacion ? `Lanzar (hasta ${fmtUsd(estimacion.costeMaximoUsd)})` : "Lanzar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
