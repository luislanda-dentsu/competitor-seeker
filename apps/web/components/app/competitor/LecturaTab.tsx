import type { LecturaFechada } from "@competitor-seeker/core";
import { fmtFecha } from "@/lib/format";

/** Lectura cualitativa completa: los bullets de cada corrida del periodo, más reciente primero. */
export function LecturaTab({ lecturas }: { lecturas: readonly LecturaFechada[] }): React.ReactElement {
  if (!lecturas.length) {
    return <p className="text-sm text-fg-muted">Sin lectura cualitativa en este periodo. Las corridas anteriores a la v2.1 no la generan: el detalle está en «Movimientos».</p>;
  }
  return (
    <ol className="flex flex-col gap-5">
      {lecturas.map((l) => (
        <li className="flex flex-col gap-2" key={l.corrida}>
          <h3 className="text-xs text-fg-dim" title={l.corrida}>
            Corrida del {fmtFecha(l.fecha)}
          </h3>
          <ul className="flex list-disc flex-col gap-1 ps-4 text-sm text-fg">
            {l.resumen.map((b, i) => (
              <li className="break-words" key={i}>
                {b}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
