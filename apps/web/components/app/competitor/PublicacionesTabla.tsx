import type { PostConEr } from "@competitor-seeker/core";
import { ExternalLink } from "lucide-react";
import { ETIQUETA_FORMATO, fmtEr } from "@/components/app/metricas/etiquetas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtFecha, fmtInt } from "@/lib/format";

/** Una fila por publicación del periodo, con sus cifras y ER. */
export function PublicacionesTabla({ publicaciones }: { publicaciones: readonly PostConEr[] }): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <Table>
        <caption className="sr-only">Publicaciones del periodo</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Formato</TableHead>
            <TableHead className="w-full">Tema</TableHead>
            <TableHead className="text-right">Likes</TableHead>
            <TableHead className="text-right">Coment.</TableHead>
            <TableHead className="text-right">Vistas</TableHead>
            <TableHead className="text-right">ER</TableHead>
            <TableHead>
              <span className="sr-only">Enlace</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {publicaciones.map((p) => (
            <TableRow key={p.url}>
              <TableCell className="font-mono text-xs tabular-nums text-fg-muted">{fmtFecha(p.fecha)}</TableCell>
              <TableCell className="text-xs">{ETIQUETA_FORMATO[p.formato]}</TableCell>
              <TableCell className="max-w-0 min-w-48 whitespace-normal">
                <span className="line-clamp-2 text-sm leading-snug" title={p.tema}>
                  {p.tema ?? "—"}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtInt(p.likes)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtInt(p.comentarios)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtInt(p.vistas)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtEr(p.er)}</TableCell>
              <TableCell>
                <a className="inline-flex items-center text-fg-muted hover:text-fg" href={p.url} rel="noreferrer noopener" target="_blank">
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  <span className="sr-only">Abrir publicación (pestaña nueva)</span>
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
