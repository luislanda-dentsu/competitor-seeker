import type { FormatoPost, MetricasCompetidor } from "@competitor-seeker/core";
import { ExternalLink } from "lucide-react";
import { MiniKpi } from "@/components/app/metricas/MiniKpi";
import { ETIQUETA_COBERTURA, ETIQUETA_FORMATO, fmtEr } from "@/components/app/metricas/etiquetas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCompacto, fmtDelta, fmtFecha, fmtInt } from "@/lib/format";

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="t-label">{titulo}</h3>
      {children}
    </section>
  );
}

const fmtProm = (n: number | null): string => (n === null ? "—" : fmtCompacto(n));

/** Todas las métricas del periodo: KPIs, rendimiento por formato, top posts y serie por corrida. */
export function RendimientoTab({ m, periodo }: { m: MetricasCompetidor; periodo: string }): React.ReactElement {
  const formatos = (Object.entries(m.er.porFormato) as [FormatoPost, { posts: number; erPromedio: number | null }][]).sort(
    (a, b) => b[1].posts - a[1].posts,
  );
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-fg-muted">
        {periodo} · {ETIQUETA_COBERTURA[m.cobertura]}
        {m.posts > 0 && ` · ${m.conCifras} de ${m.publicaciones.length} posts con cifras`}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <MiniKpi label="Publicaciones" valor={fmtInt(m.posts)} />
        <MiniKpi label="Cadencia" sub="posts/semana" valor={m.cadenciaSemanal === null ? "—" : String(m.cadenciaSemanal)} />
        <MiniKpi label="Seguidores" sub={m.seguidores.delta !== null ? `${fmtDelta(m.seguidores.delta)} en el periodo` : undefined} valor={fmtCompacto(m.seguidores.actual)} />
        <MiniKpi label="ER aprox." sub="prom. por post" title="(likes + comentarios) / seguidores" valor={fmtEr(m.er.promedio)} />
        <MiniKpi label="Vistas" sub={`prom. ${fmtProm(m.vistas.promedio)} · mediana ${fmtProm(m.vistas.mediana)}`} valor={fmtCompacto(m.vistas.n ? m.vistas.total : null)} />
        <MiniKpi label="Likes" sub={`prom. ${fmtProm(m.likes.promedio)}/post`} valor={fmtCompacto(m.likes.total || m.likes.n ? m.likes.total : null)} />
        <MiniKpi label="Comentarios" sub={`prom. ${fmtProm(m.comentarios.promedio)}/post`} valor={fmtCompacto(m.comentarios.total || m.comentarios.n ? m.comentarios.total : null)} />
      </div>

      {formatos.length > 0 && (
        <Bloque titulo="Rendimiento por formato">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Formato</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">% del total</TableHead>
                <TableHead className="text-right">ER prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formatos.map(([f, d]) => (
                <TableRow key={f}>
                  <TableCell>{ETIQUETA_FORMATO[f]}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{d.posts}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{Math.round((d.posts / m.publicaciones.length) * 100)} %</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmtEr(d.erPromedio)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Bloque>
      )}

      {m.top.length > 0 && (
        <Bloque titulo="Top publicaciones">
          <ol className="flex flex-col gap-2">
            {m.top.map((p, i) => (
              <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md bg-card-2/60 px-3 py-2 text-sm" key={p.url}>
                <span className="font-mono text-xs text-fg-dim">#{i + 1}</span>
                <span className="text-xs text-fg-muted">
                  {fmtFecha(p.fecha)} · {ETIQUETA_FORMATO[p.formato]}
                </span>
                <span className="min-w-0 flex-1 break-words text-fg">{p.tema ?? "(sin texto)"}</span>
                <span className="font-mono text-xs tabular-nums text-fg-muted">
                  ER {fmtEr(p.er)} · {fmtCompacto(p.likes)} likes · {fmtCompacto(p.vistas)} vistas
                </span>
                <a className="inline-flex items-center text-fg-muted hover:text-fg" href={p.url} rel="noreferrer noopener" target="_blank">
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  <span className="sr-only">Abrir publicación (pestaña nueva)</span>
                </a>
              </li>
            ))}
          </ol>
        </Bloque>
      )}

      {m.serie.length > 0 && (
        <Bloque titulo="Evolución por corrida">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corrida</TableHead>
                <TableHead className="text-right">Seguidores</TableHead>
                <TableHead className="text-right">Posts vistos</TableHead>
                <TableHead className="text-right">ER prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...m.serie].reverse().map((s) => (
                <TableRow key={s.corrida}>
                  <TableCell className="font-mono text-xs tabular-nums text-fg-muted" title={s.corrida}>
                    {fmtFecha(s.fecha)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmtInt(s.seguidores)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{s.posts}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmtEr(s.erPromedio)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Bloque>
      )}
    </div>
  );
}
