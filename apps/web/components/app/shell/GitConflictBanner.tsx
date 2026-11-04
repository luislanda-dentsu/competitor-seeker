"use client";

import { TriangleAlert } from "lucide-react";
import { useEstadoSync } from "@/lib/sync/cliente";

/** Banner rojo en la Home cuando el último pull terminó en conflicto. */
export function GitConflictBanner(): React.ReactElement | null {
  const { estado } = useEstadoSync();
  if (!estado?.conflicto || estado.conflicto.length === 0) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-s-no-funciona/40 bg-s-no-funciona/10 p-4 text-sm text-fg" role="alert">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-s-no-funciona" />
      <div className="flex flex-col gap-1">
        <strong className="font-medium">Conflicto al sincronizar con git</strong>
        <span className="text-fg-muted">Archivos: {estado.conflicto.join(", ")}.</span>
        <span>Resuelve en la terminal: git pull --rebase, edita, git rebase --continue</span>
      </div>
    </div>
  );
}
