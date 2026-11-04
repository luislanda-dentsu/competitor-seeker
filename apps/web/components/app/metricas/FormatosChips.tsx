import type { FormatoPost } from "@competitor-seeker/core";
import { ETIQUETA_FORMATO } from "./etiquetas";

/** Chips "Reel 3 · Carrusel 2" ordenados por frecuencia. */
export function FormatosChips({ formatos }: { formatos: Partial<Record<FormatoPost, number>> }): React.ReactElement | null {
  const lista = (Object.entries(formatos) as [FormatoPost, number][]).sort((a, b) => b[1] - a[1]);
  if (!lista.length) return null;
  return (
    <ul aria-label="Formatos publicados" className="flex flex-wrap gap-1.5">
      {lista.map(([f, n]) => (
        <li className="inline-flex h-6 items-center gap-1 rounded-pill bg-card-2 px-2 text-xs text-fg-muted" key={f}>
          {ETIQUETA_FORMATO[f]}
          <span className="font-mono tabular-nums text-fg">{n}</span>
        </li>
      ))}
    </ul>
  );
}
