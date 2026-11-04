"use client";

import { Sparkles } from "lucide-react";
import type { Sugerencia } from "@/lib/chat/tipos";
import { cn } from "@/lib/utils";

export interface SuggestionCardsProps {
  sugerencias: readonly Sugerencia[];
  disabled?: boolean;
  onElegir: (texto: string) => void;
}

/** Tres tarjetas de arranque generadas en servidor a partir de los datos de la marca. */
export function SuggestionCards({ sugerencias, disabled, onElegir }: SuggestionCardsProps): React.ReactElement {
  return (
    <ul aria-label="Sugerencias" className="grid gap-3 sm:grid-cols-3">
      {sugerencias.map((s) => (
        <li key={s.id}>
          <button
            className={cn(
              "flex h-full w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left text-sm text-fg shadow-xs transition-colors",
              "hover:border-border-strong hover:bg-card-2/60 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card",
            )}
            disabled={disabled}
            onClick={() => onElegir(s.texto)}
            type="button"
          >
            <Sparkles aria-hidden="true" className="size-4 text-fg-dim" />
            <span className="leading-snug">{s.texto}</span>
            {s.motivo && <span className="mt-auto text-xs text-fg-dim">{s.motivo}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
