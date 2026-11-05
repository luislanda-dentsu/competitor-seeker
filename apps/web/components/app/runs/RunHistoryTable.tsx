import { Check, X } from "lucide-react";
import Link from "next/link";
import type { Corrida } from "@competitor-seeker/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoBadge } from "@/components/app/runs/EstadoBadge";
import { fmtDur, fmtFecha } from "@/lib/format";
import { rutaUiCorrida } from "@/lib/runs/tipos";

function horaDe(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Verificado({ ok }: { ok: boolean }): React.ReactElement {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-s-nuevo">
      <Check aria-hidden="true" className="size-4" />
      <span className="sr-only">verificada</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-s-no-funciona">
      <X aria-hidden="true" className="size-4" />
      <span className="sr-only">no verificada</span>
    </span>
  );
}

function apifyUsd(c: Corrida): string {
  if (!c.apify || c.apify.omitido) return "—";
  return `$${(c.apify.costeEstimadoUsd ?? 0).toFixed(2)}`;
}

/** Histórico de corridas de la marca. Tabla en ≥lg, cards por debajo. */
export function RunHistoryTable({
  corridas,
  invalidas = 0,
  acciones,
  filtradas = 0,
}: {
  corridas: readonly Corrida[];
  invalidas?: number;
  /** Controles en la cabecera (p. ej. el selector de periodo). */
  acciones?: React.ReactNode;
  /** Corridas ocultas por el periodo (para el estado vacío). */
  filtradas?: number;
}): React.ReactElement {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="t-label">Histórico de corridas</CardTitle>
        {acciones}
        {invalidas > 0 && (
          <p className="text-xs text-s-no-funciona">
            {invalidas} {invalidas === 1 ? "archivo de corrida ilegible" : "archivos de corrida ilegibles"} en <code>corridas/</code>.
          </p>
        )}
      </CardHeader>
      <CardPanel className="p-0 sm:px-2 sm:pb-2">
        {corridas.length === 0 ? (
          <Empty className="py-10 md:py-12">
            <EmptyHeader>
              <EmptyTitle className="text-base font-medium">{filtradas > 0 ? "Sin corridas en este periodo" : "Sin corridas todavía"}</EmptyTitle>
              <EmptyDescription>
                {filtradas > 0
                  ? `Hay ${filtradas} ${filtradas === 1 ? "corrida" : "corridas"} fuera del periodo. Amplía el rango para verlas.`
                  : "Lanza la primera con «Correr ahora». El histórico aparecerá aquí."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Intentos</TableHead>
                    <TableHead>Verif.</TableHead>
                    <TableHead className="text-right">Objeciones</TableHead>
                    <TableHead className="text-right">Apify $</TableHead>
                    <TableHead className="text-right">Duración</TableHead>
                    <TableHead>Modo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corridas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link className="font-medium text-fg underline-offset-4 hover:underline" href={rutaUiCorrida(c.marca, c.id)}>
                          {fmtFecha(c.fecha)}
                        </Link>
                        <span className="ms-2 font-mono text-xs text-fg-muted">{horaDe(c.inicio)}</span>
                      </TableCell>
                      <TableCell>
                        <EstadoBadge estado={c.estado} />
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{c.entradas.length}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{c.intentos}</TableCell>
                      <TableCell>
                        <Verificado ok={c.verificado} />
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{c.objeciones.length}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{apifyUsd(c)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{fmtDur(c.duracionMs)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.modo}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="flex flex-col divide-y divide-border lg:hidden">
              {corridas.map((c) => (
                <li className="flex flex-col gap-2 px-4 py-3" key={c.id}>
                  <div className="flex items-center justify-between gap-2">
                    <Link className="font-medium text-fg underline-offset-4 hover:underline" href={rutaUiCorrida(c.marca, c.id)}>
                      {fmtFecha(c.fecha)} <span className="font-mono text-xs text-fg-muted">{horaDe(c.inicio)}</span>
                    </Link>
                    <EstadoBadge estado={c.estado} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                    <span>
                      <span className="font-mono tabular-nums text-fg">{c.entradas.length}</span> entradas
                    </span>
                    <span>
                      <span className="font-mono tabular-nums text-fg">{c.intentos}</span> intentos
                    </span>
                    <Verificado ok={c.verificado} />
                    <span>
                      <span className="font-mono tabular-nums text-fg">{c.objeciones.length}</span> objeciones
                    </span>
                    <span className="font-mono tabular-nums">{apifyUsd(c)}</span>
                    <span className="font-mono tabular-nums">{fmtDur(c.duracionMs)}</span>
                    <Badge variant="outline">{c.modo}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardPanel>
    </Card>
  );
}
