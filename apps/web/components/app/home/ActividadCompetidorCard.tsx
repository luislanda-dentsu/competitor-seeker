import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { FormatosChips } from "@/components/app/metricas/FormatosChips";
import { MiniKpi } from "@/components/app/metricas/MiniKpi";
import { ETIQUETA_COBERTURA, fmtEr } from "@/components/app/metricas/etiquetas";
import { Badge } from "@/components/ui/badge";
import { Card, CardPanel } from "@/components/ui/card";
import type { ActividadCompetidor } from "@/lib/data/actividad";
import { fmtCompacto, fmtDelta, fmtFecha } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Módulo del panel de actividad: KPIs del periodo de un competidor y la
 * lectura cualitativa (bullets) de su corrida más reciente del periodo.
 */
export function ActividadCompetidorCard({ actividad, query }: { actividad: ActividadCompetidor; query: string }): React.ReactElement {
  const { competidor, metricas: m } = actividad;
  const href = `/competidores/${encodeURIComponent(competidor.slug)}?${query}`;
  const lectura = m.lecturas[0];
  const delta = m.seguidores.delta;

  return (
    <Card data-competidor={competidor.nombre}>
      <CardPanel className="flex flex-col gap-4 p-5">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link className="truncate text-base font-medium text-fg underline-offset-2 hover:underline" href={href}>
              {competidor.nombre}
            </Link>
            <span className="text-xs text-fg-muted">
              {m.seguidores.actual !== null ? (
                <>
                  <span className="font-mono tabular-nums text-fg">{fmtCompacto(m.seguidores.actual)}</span> seguidores
                  {delta !== null && (
                    <span className={cn("ms-1.5 font-mono tabular-nums", delta > 0 ? "text-s-nuevo" : delta < 0 ? "text-s-no-funciona" : "text-fg-muted")}>
                      {fmtDelta(delta)}
                    </span>
                  )}
                </>
              ) : (
                "seguidores sin dato"
              )}
            </span>
          </div>
          {m.cobertura !== "completa" && (
            <Badge title="Las corridas anteriores a la v2.1 solo guardan totales por movimiento" variant="secondary">
              {ETIQUETA_COBERTURA[m.cobertura]}
            </Badge>
          )}
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <MiniKpi label="Posts" sub={m.cadenciaSemanal !== null ? `${m.cadenciaSemanal}/sem` : undefined} valor={String(m.posts)} />
          <MiniKpi label="Vistas" valor={fmtCompacto(m.vistas.n ? m.vistas.total : null)} />
          <MiniKpi label="Likes" valor={fmtCompacto(m.likes.n || m.likes.total ? m.likes.total : null)} />
          <MiniKpi label="Coment." valor={fmtCompacto(m.comentarios.n || m.comentarios.total ? m.comentarios.total : null)} />
          <MiniKpi
            className="col-span-2 sm:col-span-1"
            label="ER aprox."
            title="(likes + comentarios) / seguidores, promedio por post"
            valor={fmtEr(m.er.promedio)}
          />
        </div>

        <FormatosChips formatos={m.formatos} />

        <section aria-label="Lectura del periodo" className="flex flex-col gap-2">
          {lectura ? (
            <>
              <h3 className="text-xs text-fg-dim">
                Lectura de la corrida del {fmtFecha(lectura.fecha)}
                {m.lecturas.length > 1 && ` · ${m.lecturas.length} en el periodo`}
              </h3>
              <ul className="flex list-disc flex-col gap-1 ps-4 text-sm text-fg">
                {lectura.resumen.slice(0, 5).map((b, i) => (
                  <li className="break-words" key={i}>
                    {b}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-fg-muted">Sin lectura cualitativa en este periodo (las corridas anteriores a la v2.1 no la generan).</p>
          )}
        </section>

        <Link className="inline-flex items-center gap-1 self-start text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline" href={href}>
          Análisis completo
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </CardPanel>
    </Card>
  );
}
