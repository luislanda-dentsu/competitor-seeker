"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import { EstadoBadge } from "@/components/app/runs/EstadoBadge";
import { fmtDur } from "@/lib/format";
import type { ResumenFin } from "@/lib/runs/consola";

function textoResumen(fin: ResumenFin): string {
  const partes: string[] = [];
  const n = fin.entradas ?? 0;
  partes.push(`${n} ${n === 1 ? "entrada" : "entradas"}`);
  if (fin.verificado) partes.push(`verificada en intento ${fin.intentos ?? 1}`);
  else if (fin.estado === "pendiente-confirmacion") partes.push(`sin verificar tras ${fin.intentos ?? 0} intentos`);
  else if (fin.estado === "error") partes.push(fin.error ? `error: ${fin.error}` : "error");
  if (fin.duracionMs !== undefined) partes.push(fmtDur(fin.duracionMs));
  if (fin.apify && !fin.apify.motivo) partes.push(`Apify $${(fin.apify.costeEstimadoUsd ?? 0).toFixed(2)}`);
  else if (fin.apify?.motivo) partes.push(`Apify omitido (${fin.apify.motivo})`);
  if (fin.ig?.sesion === "no-disponible") partes.push("IG sin sesión");
  return partes.join(" · ");
}

/** Card clara con el cierre de la corrida. */
export function RunSummary({
  fin,
  onRevisar,
  className,
}: {
  fin: ResumenFin;
  /** Reabre el diálogo de confirmación cuando quedó pendiente. */
  onRevisar?: () => void;
  className?: string;
}): React.ReactElement {
  return (
    <Card className={className ?? "rounded-lg"} role="status">
      <CardPanel className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5">
        <EstadoBadge estado={fin.estado ?? "desconocido"} />
        <span className="text-sm text-fg">{textoResumen(fin)}</span>
        <span className="ms-auto flex items-center gap-2">
          {fin.estado === "pendiente-confirmacion" && onRevisar && (
            <Button onClick={onRevisar} size="sm" variant="outline">
              Revisar objeciones
            </Button>
          )}
          {fin.corridaId && (
            <Button render={<Link href={`/corridas/${fin.corridaId}`} />} size="sm" variant="ghost">
              Ver detalle
            </Button>
          )}
        </span>
      </CardPanel>
    </Card>
  );
}
