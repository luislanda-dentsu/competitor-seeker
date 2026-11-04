"use client";

import { Copy, X } from "lucide-react";
import { SignalBadge } from "@/components/app/signals/SignalBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtFecha } from "@/lib/format";
import type { ArtefactoUi } from "@/lib/chat/tipos";
import { cn } from "@/lib/utils";

function csvCelda(v: string): string {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV con cabecera (separador coma) de las entradas citadas. */
export function artefactoACsv(a: ArtefactoUi): string {
  const filas = [["id", "competidor", "fecha", "senal", "movimiento", "lectura"]];
  for (const e of a.entradas) filas.push([e.id, e.marca, e.fecha, e.senal, e.movimiento, e.lectura]);
  return filas.map((f) => f.map(csvCelda).join(",")).join("\n");
}

export interface ArtifactPanelProps {
  artefacto: ArtefactoUi;
  onCerrar: () => void;
  /** Sin cabecera propia (dentro de un Drawer que ya la pone). */
  sinCabecera?: boolean;
  className?: string;
}

/** Tabla de entradas citadas: competidor · fecha · señal · movimiento · lectura. */
export function ArtifactPanel({ artefacto, onCerrar, sinCabecera, className }: ArtifactPanelProps): React.ReactElement {
  const copiarCsv = () => {
    navigator.clipboard
      .writeText(artefactoACsv(artefacto))
      .then(() => toastManager.add({ title: "CSV copiado", type: "success", timeout: 1500 }))
      .catch(() => toastManager.add({ title: "No se pudo copiar", type: "error" }));
  };

  return (
    <aside aria-label={`Entradas citadas: ${artefacto.titulo}`} className={cn("flex min-h-0 flex-col rounded-xl border border-border bg-card", className)}>
      {!sinCabecera && (
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-medium text-fg">{artefacto.titulo}</h2>
            <p className="text-xs text-fg-dim">
              {artefacto.entradas.length} {artefacto.entradas.length === 1 ? "entrada" : "entradas"}
              {artefacto.faltantes.length > 0 && ` · ${artefacto.faltantes.length} id sin resolver`}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger render={<Button aria-label="Copiar CSV" className="text-fg-muted" onClick={copiarCsv} size="icon-sm" variant="ghost" />}>
              <Copy aria-hidden="true" />
            </TooltipTrigger>
            <TooltipPopup>Copiar CSV</TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button aria-label="Cerrar panel" className="text-fg-muted" onClick={onCerrar} size="icon-sm" variant="ghost" />}>
              <X aria-hidden="true" />
            </TooltipTrigger>
            <TooltipPopup>Cerrar</TooltipPopup>
          </Tooltip>
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {artefacto.entradas.length === 0 ? (
          <p className="p-4 text-sm text-fg-muted">Ninguno de los ids citados existe en el log de esta marca.</p>
        ) : (
          <Table className="text-[13px]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Competidor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Señal</TableHead>
                <TableHead className="min-w-56">Movimiento</TableHead>
                <TableHead className="min-w-48">Lectura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artefacto.entradas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap font-medium text-fg">{e.marca}</TableCell>
                  <TableCell className="whitespace-nowrap text-fg-muted">{fmtFecha(e.fecha)}</TableCell>
                  <TableCell>
                    <SignalBadge senal={e.senal} size="sm" />
                  </TableCell>
                  <TableCell className="whitespace-normal align-top leading-snug text-fg">{e.movimiento}</TableCell>
                  <TableCell className="whitespace-normal align-top leading-snug text-fg-muted">{e.lectura}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {artefacto.faltantes.length > 0 && (
          <p className="border-t border-border px-4 py-2 font-mono text-[11px] text-fg-dim">Sin resolver: {artefacto.faltantes.join(", ")}</p>
        )}
      </div>
      {sinCabecera && (
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <Button onClick={copiarCsv} size="sm" variant="outline">
            <Copy aria-hidden="true" />
            Copiar CSV
          </Button>
          <Button onClick={onCerrar} size="sm" variant="ghost">
            Cerrar
          </Button>
        </div>
      )}
    </aside>
  );
}
