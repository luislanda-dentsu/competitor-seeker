"use client";

import { GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { detalleSync, horaSync, nivelSync, useEstadoSync, type NivelSync } from "@/lib/sync/cliente";
import { cn } from "@/lib/utils";

const PUNTO: Record<NivelSync, string> = {
  ok: "bg-s-nuevo",
  pendiente: "bg-s-confuso",
  error: "bg-s-no-funciona",
  "sin-remoto": "bg-fg-muted",
  pausado: "bg-fg-dim",
};

const ETIQUETA: Record<NivelSync, string> = {
  ok: "Al día",
  pendiente: "Pendiente",
  error: "Con error",
  "sin-remoto": "Sin remoto",
  pausado: "En pausa",
};

/** Píldora de estado de git. `compacto` la muestra como badge sin popover (RunLauncher). */
export function GitSyncStatus({ compacto = false }: { compacto?: boolean }): React.ReactElement {
  const { estado, sincronizando, sincronizar } = useEstadoSync();
  const nivel = nivelSync(estado);
  const pastilla = (
    <>
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", PUNTO[nivel])} />
      <GitBranch aria-hidden="true" className="size-3.5" />
      <span>{ETIQUETA[nivel]}</span>
    </>
  );
  const clases = "inline-flex h-8 items-center gap-1.5 rounded-pill bg-card-2 px-2.5 text-xs text-fg";

  if (compacto) {
    return (
      <span className={clases} title={detalleSync(estado)}>
        {pastilla}
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger aria-label={`Sincronización git: ${ETIQUETA[nivel]}`} className={cn(clases, "hidden cursor-pointer md:inline-flex")} title={detalleSync(estado)}>
        {pastilla}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-[min(20rem,calc(100vw-2rem))]" side="bottom">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-fg">Sincronización entre Macs</h2>
          <p className="text-sm text-fg-muted">{detalleSync(estado)}</p>
          {estado?.remoto && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-fg-muted">
              <dt>Rama</dt>
              <dd className="font-mono text-fg">{estado.rama}</dd>
              <dt>Último pull</dt>
              <dd>{horaSync(estado.ultimoPull)}</dd>
              <dt>Último push</dt>
              <dd>{horaSync(estado.ultimoPush)}</dd>
            </dl>
          )}
          {nivel === "error" && estado?.conflicto && (
            <p className="text-xs text-s-no-funciona">Resuelve en la terminal: git pull --rebase, edita, git rebase --continue</p>
          )}
          <Button disabled={!estado?.remoto || sincronizando} loading={sincronizando} onClick={() => void sincronizar()} size="sm" variant="outline">
            <RefreshCw aria-hidden="true" />
            Sincronizar ahora
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
