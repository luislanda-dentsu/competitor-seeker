"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { EntryTimeline } from "@/components/app/competitor/EntryTimeline";
import { SIGNAL_META, type Senal } from "@/components/app/signals/signal-meta";
import { Input } from "@/components/ui/input";
import {
  filtrarGrupos,
  SENALES_ORDEN,
  type ConteoSenales,
  type GrupoCorrida,
} from "@/lib/data/agrupar";
import { cn } from "@/lib/utils";

/**
 * Pestaña Histórico: chips de filtro por señal (con conteo), buscador y
 * EntryTimeline agrupado por corrida. El filtrado es puro (lib/data).
 */
export function HistoricoTab({
  grupos,
  conteo,
}: {
  grupos: GrupoCorrida[];
  conteo: ConteoSenales;
}): React.ReactElement {
  const [senales, setSenales] = useState<Senal[]>([]);
  const [texto, setTexto] = useState("");

  const filtrados = useMemo(
    () => filtrarGrupos(grupos, { senales, texto }),
    [grupos, senales, texto],
  );
  const total = grupos.reduce((acc, g) => acc + g.entradas.length, 0);
  const visibles = filtrados.reduce((acc, g) => acc + g.entradas.length, 0);

  const toggle = (s: Senal): void =>
    setSenales((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div aria-label="Filtrar por señal" className="flex flex-wrap gap-2" role="group">
          {SENALES_ORDEN.map((s) => {
            const activo = senales.includes(s);
            const meta = SIGNAL_META[s];
            return (
              <button
                aria-pressed={activo}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-pill border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
                  activo
                    ? cn("border-transparent", meta.bg, meta.text)
                    : "border-border bg-transparent text-fg-muted hover:bg-card-2 hover:text-fg",
                  conteo[s] === 0 && !activo && "opacity-50",
                )}
                key={s}
                onClick={() => toggle(s)}
                type="button"
              >
                <span aria-hidden="true" className={cn("size-1.5 rounded-full", meta.dot)} />
                {meta.label}
                <span className="font-mono tabular-nums">{conteo[s]}</span>
              </button>
            );
          })}
          {senales.length > 0 && (
            <button
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-pill px-2 text-xs text-fg-dim hover:text-fg"
              onClick={() => setSenales([])}
              type="button"
            >
              <X aria-hidden="true" className="size-3" />
              Limpiar
            </button>
          )}
        </div>
        <div className="relative w-full md:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-fg-dim"
          />
          <Input
            aria-label="Buscar en movimientos y lecturas"
            className="[&_input]:ps-8"
            onChange={(ev) => setTexto(ev.target.value)}
            placeholder="Buscar en el histórico…"
            size="sm"
            type="search"
            value={texto}
          />
        </div>
      </div>
      <p aria-live="polite" className="text-xs text-fg-dim">
        {visibles === total
          ? `${total} ${total === 1 ? "entrada" : "entradas"} en ${grupos.length} ${grupos.length === 1 ? "corrida" : "corridas"}`
          : `${visibles} de ${total} entradas`}
      </p>
      <EntryTimeline grupos={filtrados} />
    </div>
  );
}
