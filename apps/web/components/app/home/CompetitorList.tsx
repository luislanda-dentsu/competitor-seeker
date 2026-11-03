"use client";

import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { SignalBadge } from "@/components/app/signals/SignalBadge";
import { SignalDot } from "@/components/app/signals/SignalDot";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { CompetidorResumen } from "@/lib/data/marca";
import { fmtFecha, fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

function NombreLink({ c, className }: { c: CompetidorResumen; className?: string }): React.ReactElement {
  return (
    <Link
      className={cn(
        "truncate font-medium text-fg underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        className,
      )}
      href={`/competidores/${c.slug}`}
    >
      {c.nombre}
      {!c.activo && <span className="ms-1.5 text-xs font-normal text-fg-dim">(inactivo)</span>}
    </Link>
  );
}

function SemaforoDot({ c }: { c: CompetidorResumen }): React.ReactElement {
  if (c.senal) return <SignalDot senal={c.senal} size="lg" />;
  return (
    <span
      aria-label="Sin registros"
      className="inline-block size-2.5 shrink-0 rounded-full border border-border-strong"
      role="img"
      title="Sin registros"
    />
  );
}

function Tarjeta({ c }: { c: CompetidorResumen }): React.ReactElement {
  const e = c.semaforo;
  return (
    <Card className="gap-3 rounded-lg p-4" render={<li />}>
      <div className="flex items-center gap-2.5">
        <SemaforoDot c={c} />
        <NombreLink c={c} className="min-w-0 flex-1" />
        {c.senal && <SignalBadge senal={c.senal} size="sm" />}
      </div>
      {e ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tabular-nums text-fg-dim">
            {fmtFecha(e.fecha)}
          </span>
          <p className="line-clamp-2 text-sm text-fg" title={e.movimiento}>
            {e.movimiento}
          </p>
          <p className="line-clamp-2 text-xs text-fg-muted">
            <span className="font-medium text-fg-dim">Lectura:</span> {e.lectura}
          </p>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">Sin registros todavía.</p>
      )}
      <div className="mt-auto flex items-center justify-between text-xs text-fg-dim">
        <span>
          <span className="font-mono tabular-nums text-fg-muted">{fmtInt(c.total)}</span>{" "}
          {c.total === 1 ? "registro" : "registros"}
        </span>
        <Link className="text-fg-muted hover:text-fg" href={`/competidores/${c.slug}`}>
          Ver ficha →
        </Link>
      </div>
    </Card>
  );
}

function Tabla({ competidores }: { competidores: CompetidorResumen[] }): React.ReactElement {
  return (
    <Table>
      <caption className="sr-only">Competidores de la marca con su semáforo</caption>
      <TableHeader>
        <TableRow>
          <TableHead>Competidor</TableHead>
          <TableHead>Señal</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="w-full">Último movimiento</TableHead>
          <TableHead className="text-right">Registros</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {competidores.map((c) => (
          <TableRow key={c.slug}>
            <TableCell>
              <span className="flex items-center gap-2">
                <SemaforoDot c={c} />
                <NombreLink c={c} />
              </span>
            </TableCell>
            <TableCell>
              {c.senal ? <SignalBadge senal={c.senal} size="sm" /> : <span className="text-fg-dim">—</span>}
            </TableCell>
            <TableCell className="font-mono text-xs tabular-nums text-fg-muted">
              {fmtFecha(c.ultimaFecha)}
            </TableCell>
            <TableCell className="max-w-0 whitespace-normal">
              {c.semaforo ? (
                <span className="line-clamp-2 text-sm leading-snug" title={c.semaforo.movimiento}>
                  {c.semaforo.movimiento}
                </span>
              ) : (
                <span className="text-fg-dim">Sin registros</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">{fmtInt(c.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Lista de competidores con semáforo: Tabs "Tarjetas | Tabla". */
export function CompetitorList({ competidores }: { competidores: CompetidorResumen[] }): React.ReactElement {
  return (
    <Tabs className="gap-3" defaultValue="tarjetas">
      <TabsList aria-label="Vista de competidores" size="sm">
        <TabsTab value="tarjetas">
          <LayoutGrid aria-hidden="true" className="size-3.5" />
          Tarjetas
        </TabsTab>
        <TabsTab value="tabla">
          <List aria-hidden="true" className="size-3.5" />
          Tabla
        </TabsTab>
      </TabsList>
      <TabsPanel value="tarjetas">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {competidores.map((c) => (
            <Tarjeta c={c} key={c.slug} />
          ))}
        </ul>
      </TabsPanel>
      <TabsPanel value="tabla">
        <Tabla competidores={competidores} />
      </TabsPanel>
    </Tabs>
  );
}
