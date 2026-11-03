import type { Entrada } from "@competitor-seeker/core";
import { ExternalLink } from "lucide-react";
import { SignalBadge } from "@/components/app/signals/SignalBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtFecha, fmtInt } from "@/lib/format";

/** Métricas de Instagram (Apify) de las entradas que las traen. */
export function PostMetricsTable({ entradas }: { entradas: Entrada[] }): React.ReactElement {
  return (
    <Table>
      <caption className="sr-only">Métricas de Instagram por entrada</caption>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead className="w-full">Movimiento</TableHead>
          <TableHead>Señal</TableHead>
          <TableHead className="text-right">Likes</TableHead>
          <TableHead className="text-right">Comentarios</TableHead>
          <TableHead className="text-right">Vistas</TableHead>
          <TableHead className="text-right">Posts</TableHead>
          <TableHead>Evidencia</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entradas.map((e) => {
          const m = e.metricas ?? {};
          return (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs tabular-nums text-fg-muted">
                {fmtFecha(e.fecha)}
              </TableCell>
              <TableCell className="max-w-0 whitespace-normal">
                <span className="line-clamp-2 text-sm leading-snug" title={e.movimiento}>
                  {e.movimiento}
                </span>
              </TableCell>
              <TableCell>
                <SignalBadge senal={e.senal} size="sm" />
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtInt(m.likes)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtInt(m.comentarios)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtInt(m.vistas)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtInt(m.posts)}</TableCell>
              <TableCell>
                {e.evidencia && e.evidencia.length > 0 ? (
                  <a
                    className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
                    href={e.evidencia[0]}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" className="size-3" />
                    abrir
                    {e.evidencia.length > 1 && <span className="text-fg-dim">+{e.evidencia.length - 1}</span>}
                  </a>
                ) : (
                  <span className="text-fg-dim">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
