import type { Confianza, EstrategiaCompetidor, LecturaFechada } from "@competitor-seeker/core";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtFecha } from "@/lib/format";

const VARIANTE: Record<Confianza, "success" | "warning" | "secondary"> = { alta: "success", media: "warning", baja: "secondary" };

function Lista({ titulo, items }: { titulo: string; items: readonly string[] }): React.ReactElement | null {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="t-label">{titulo}</h4>
      <ul className="flex list-disc flex-col gap-1 ps-4 text-sm text-fg">
        {items.map((x, i) => (
          <li className="break-words" key={i}>
            {x}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Estrategia({ e }: { e: EstrategiaCompetidor }): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <Lista items={e.hipotesis} titulo="Qué parece estar haciendo" />
      {e.pilares.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="t-label">Pilares de contenido</h4>
          <ul className="flex flex-wrap gap-1.5">
            {e.pilares.map((p) => (
              <li className="rounded-pill bg-card-2 px-2.5 py-0.5 text-xs text-fg" key={p}>
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-1.5">
        <h4 className="t-label">Formatos y cadencia</h4>
        <p className="text-sm text-fg">{e.formatosYCadencia}</p>
      </section>
      <Lista items={e.implicaciones} titulo="Qué significa para nosotros" />
      {e.postsCitados.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="t-label">Evidencia</h4>
          <ul className="flex flex-col gap-1 text-xs">
            {e.postsCitados.map((u) => (
              <li className="truncate" key={u}>
                <a className="text-fg-muted underline-offset-2 hover:text-fg hover:underline" href={u} rel="noreferrer noopener" target="_blank">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Lectura estratégica que el analista infiere en cada corrida (y el verificador
 * refuta contra la evidencia). Muestra la más reciente del periodo; las demás, plegadas.
 */
export function EstrategiaTab({ lecturas }: { lecturas: readonly LecturaFechada[] }): React.ReactElement {
  const conEstrategia = lecturas.filter((l): l is LecturaFechada & { estrategia: EstrategiaCompetidor } => l.estrategia !== undefined);
  if (!conEstrategia.length) {
    return (
      <p className="text-sm text-fg-muted">
        Sin lectura estratégica en este periodo. El analista solo la escribe cuando hay publicaciones suficientes para sostenerla.
      </p>
    );
  }
  const [ultima, ...anteriores] = conEstrategia;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-2">
        <Sparkles aria-hidden="true" className="size-4 text-fg-muted" />
        <span className="text-sm text-fg">Lectura de la corrida del {fmtFecha(ultima!.fecha)}</span>
        <Badge variant={VARIANTE[ultima!.estrategia.confianza]}>confianza {ultima!.estrategia.confianza}</Badge>
      </header>
      <Estrategia e={ultima!.estrategia} />
      {anteriores.length > 0 && (
        <details className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm text-fg-muted">
            {anteriores.length} {anteriores.length === 1 ? "lectura anterior" : "lecturas anteriores"} del periodo
          </summary>
          <div className="mt-4 flex flex-col gap-6">
            {anteriores.map((l) => (
              <div className="flex flex-col gap-3" key={l.corrida}>
                <p className="text-xs text-fg-dim">
                  Corrida del {fmtFecha(l.fecha)} · confianza {l.estrategia.confianza}
                </p>
                <Estrategia e={l.estrategia} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
