"use client";

import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ChartTableProps {
  /** Resumen accesible de la tabla (caption). */
  caption: string;
  columnas: string[];
  filas: (string | number)[][];
  className?: string;
}

/**
 * Alternativa textual a una gráfica: Collapsible "Ver como tabla" con una
 * tabla simple. Las celdas numéricas van en mono tabular.
 */
export function ChartTable({ caption, columnas, filas, className }: ChartTableProps): React.ReactElement {
  return (
    <Collapsible className={cn("flex flex-col gap-2", className)}>
      <CollapsibleTrigger className="group inline-flex h-7 w-fit items-center gap-1 rounded-md px-1.5 text-xs text-fg-muted transition-colors hover:bg-card-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1">
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 transition-transform group-data-panel-open:rotate-180"
        />
        Ver como tabla
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <Table className="text-xs">
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              {columnas.map((c, i) => (
                <TableHead className={cn("h-8", i > 0 && "text-right")} key={c}>
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila, r) => (
              <TableRow key={r}>
                {fila.map((celda, i) => (
                  <TableCell
                    className={cn("py-1.5", i > 0 && "text-right font-mono tabular-nums")}
                    key={i}
                  >
                    {celda}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsiblePanel>
    </Collapsible>
  );
}
