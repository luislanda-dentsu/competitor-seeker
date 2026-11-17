import type { EstrategiaCompetidor, FormatoPost, LecturaFechada } from "@competitor-seeker/core";
import { ETIQUETA_COBERTURA, ETIQUETA_FORMATO, fmtEr } from "@/components/app/metricas/etiquetas";
import { SIGNAL_META } from "@/components/app/signals/signal-meta";
import { SENALES_ORDEN } from "@/lib/data/agrupar";
import type { InformeCompetidor as Datos } from "@/lib/data/informe";
import { fmtDelta, fmtFecha, fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/** URL legible en papel: sin protocolo ni «www.». */
const corta = (u: string): string => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="informe-seccion flex flex-col gap-2.5">
      <h3 className="border-b border-border pb-1 text-sm font-semibold text-fg">{titulo}</h3>
      {children}
    </section>
  );
}

const Vacio = ({ children }: { children: React.ReactNode }): React.ReactElement => <p className="text-xs text-fg-muted">{children}</p>;

function Kpi({ label, valor, sub }: { label: string; valor: string; sub?: string }): React.ReactElement {
  return (
    <div className="informe-fila flex flex-col gap-0.5 rounded-md border border-border px-2.5 py-2">
      <span className="text-[10px] font-medium tracking-wide text-fg-muted uppercase">{label}</span>
      <span className="font-mono text-base font-semibold tabular-nums text-fg">{valor}</span>
      {sub && <span className="text-[10px] text-fg-muted">{sub}</span>}
    </div>
  );
}

/** Tabla plana para papel: cabecera que se repite en cada página y filas que no se parten. */
function Tabla({ cols, filas, derecha = [] }: { cols: string[]; filas: React.ReactNode[][]; derecha?: number[] }): React.ReactElement {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th className={cn("border-b border-border-strong py-1 pe-2 font-medium text-fg-muted", derecha.includes(i) ? "text-right" : "text-left")} key={c}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr className="informe-fila align-top" key={i}>
            {f.map((celda, j) => (
              <td className={cn("border-b border-border py-1 pe-2 text-fg", derecha.includes(j) && "text-right font-mono tabular-nums")} key={j}>
                {celda}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Lista({ titulo, items }: { titulo: string; items: readonly string[] }): React.ReactElement | null {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-medium text-fg-muted">{titulo}</h4>
      <ul className="flex list-disc flex-col gap-0.5 ps-4 text-xs text-fg">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function Estrategia({ l, e }: { l: LecturaFechada; e: EstrategiaCompetidor }): React.ReactElement {
  return (
    <div className="informe-fila flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-xs text-fg-muted">
        Corrida del {fmtFecha(l.fecha)} · confianza {e.confianza}
      </p>
      <Lista items={e.hipotesis} titulo="Qué parece estar haciendo" />
      {e.pilares.length > 0 && <p className="text-xs text-fg"><span className="font-medium text-fg-muted">Pilares: </span>{e.pilares.join(" · ")}</p>}
      <p className="text-xs text-fg"><span className="font-medium text-fg-muted">Formatos y cadencia: </span>{e.formatosYCadencia}</p>
      <Lista items={e.implicaciones} titulo="Qué significa para nosotros" />
      {e.postsCitados.length > 0 && <p className="break-all font-mono text-[10px] text-fg-muted">Evidencia: {e.postsCitados.map(corta).join(" · ")}</p>}
    </div>
  );
}

/** Ficha completa de un competidor para el PDF: las seis pestañas, desplegadas y acotadas al periodo. */
export function InformeCompetidor({ d, indice }: { d: Datos; indice: number }): React.ReactElement {
  const m = d.metricas;
  const formatos = (Object.entries(m.er.porFormato) as [FormatoPost, { posts: number; erPromedio: number | null }][]).sort((a, b) => b[1].posts - a[1].posts);
  const conEstrategia = m.lecturas.filter((l): l is LecturaFechada & { estrategia: EstrategiaCompetidor } => l.estrategia !== undefined);
  const nMov = d.movimientos.reduce((a, g) => a + g.entradas.length, 0);
  const perfil = d.competidor.instagram ?? d.competidor.url;

  return (
    <article className="informe-competidor flex flex-col gap-5">
      <header className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] text-fg-muted">{String(indice).padStart(2, "0")}</span>
        <h2 className="text-xl font-semibold text-fg">{d.competidor.nombre}</h2>
        <p className="text-xs text-fg-muted">
          {perfil ? `${corta(perfil)} · ` : ""}
          {ETIQUETA_COBERTURA[m.cobertura]}
          {m.posts > 0 && ` · ${m.conCifras} de ${m.publicaciones.length} posts con cifras`}
        </p>
      </header>

      <Seccion titulo="Rendimiento">
        <div className="grid grid-cols-4 gap-2">
          <Kpi label="Publicaciones" valor={fmtInt(m.posts)} />
          <Kpi label="Cadencia" sub="posts/semana" valor={m.cadenciaSemanal === null ? "—" : String(m.cadenciaSemanal)} />
          <Kpi label="Seguidores" sub={m.seguidores.delta !== null ? `${fmtDelta(m.seguidores.delta)} en el periodo` : undefined} valor={fmtInt(m.seguidores.actual)} />
          <Kpi label="ER aprox." sub="prom. por post" valor={fmtEr(m.er.promedio)} />
          <Kpi label="Likes" sub={`prom. ${fmtInt(m.likes.promedio)}/post`} valor={m.likes.n ? fmtInt(m.likes.total) : "—"} />
          <Kpi label="Comentarios" sub={`prom. ${fmtInt(m.comentarios.promedio)}/post`} valor={m.comentarios.n ? fmtInt(m.comentarios.total) : "—"} />
          <Kpi label="Vistas" sub={`prom. ${fmtInt(m.vistas.promedio)} · mediana ${fmtInt(m.vistas.mediana)}`} valor={m.vistas.n ? fmtInt(m.vistas.total) : "—"} />
          <Kpi label="Movimientos" sub={SENALES_ORDEN.filter((s) => d.conteo[s]).map((s) => `${d.conteo[s]} ${SIGNAL_META[s].label.toLowerCase()}`).join(" · ") || undefined} valor={fmtInt(nMov)} />
        </div>
        {formatos.length > 0 && (
          <Tabla
            cols={["Formato", "Posts", "% del total", "ER prom."]}
            derecha={[1, 2, 3]}
            filas={formatos.map(([f, x]) => [ETIQUETA_FORMATO[f], x.posts, fmtPct(x.posts / m.publicaciones.length), fmtEr(x.erPromedio)])}
          />
        )}
        {m.top.length > 0 && (
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-medium text-fg-muted">Top publicaciones</h4>
            <ol className="flex flex-col gap-1 text-xs">
              {m.top.map((p, i) => (
                <li className="informe-fila text-fg" key={p.url}>
                  <span className="font-mono text-fg-muted">#{i + 1}</span> {fmtFecha(p.fecha)} · {ETIQUETA_FORMATO[p.formato]} · {p.tema ?? "(sin texto)"}{" "}
                  <span className="font-mono text-fg-muted">
                    (ER {fmtEr(p.er)} · {fmtInt(p.likes)} likes · {fmtInt(p.comentarios)} coment. · {fmtInt(p.vistas)} vistas)
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Seccion>

      <Seccion titulo={`Publicaciones (${m.publicaciones.length})`}>
        {m.publicaciones.length ? (
          <Tabla
            cols={["Fecha", "Formato", "Tema", "Likes", "Coment.", "Vistas", "ER"]}
            derecha={[3, 4, 5, 6]}
            filas={m.publicaciones.map((p) => [
              <span className="whitespace-nowrap font-mono" key="f">{fmtFecha(p.fecha)}</span>,
              ETIQUETA_FORMATO[p.formato],
              <span className="flex flex-col" key="t">
                <span>{p.tema ?? "—"}</span>
                <span className="break-all font-mono text-[9px] text-fg-muted">{corta(p.url)}</span>
              </span>,
              fmtInt(p.likes),
              fmtInt(p.comentarios),
              fmtInt(p.vistas),
              fmtEr(p.er),
            ])}
          />
        ) : (
          <Vacio>Sin publicaciones registradas en este periodo.</Vacio>
        )}
      </Seccion>

      <Seccion titulo="Lectura">
        {m.lecturas.length ? (
          m.lecturas.map((l) => (
            <div className="informe-fila flex flex-col gap-1" key={l.corrida}>
              <p className="text-xs text-fg-muted">Corrida del {fmtFecha(l.fecha)}</p>
              <ul className="flex list-disc flex-col gap-0.5 ps-4 text-xs text-fg">
                {l.resumen.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <Vacio>Sin lectura cualitativa en este periodo.</Vacio>
        )}
      </Seccion>

      <Seccion titulo="Estrategia (IA)">
        {conEstrategia.length ? conEstrategia.map((l) => <Estrategia e={l.estrategia} key={l.corrida} l={l} />) : <Vacio>Sin lectura estratégica en este periodo.</Vacio>}
      </Seccion>

      <Seccion titulo={`Movimientos (${nMov})`}>
        {d.movimientos.length ? (
          d.movimientos.map((g) => (
            <div className="flex flex-col gap-1.5" key={g.corridaId}>
              <p className="font-mono text-[10px] text-fg-muted">Corrida {g.corridaId}</p>
              {g.entradas.map((e) => (
                <div className="informe-fila flex flex-col gap-0.5 border-s-2 border-border ps-2.5" key={e.id}>
                  <p className="text-xs text-fg-muted">
                    <span className="font-mono">{fmtFecha(e.fecha)}</span> ·{" "}
                    <span className={cn("rounded px-1 font-medium", SIGNAL_META[e.senal].bg, SIGNAL_META[e.senal].text)}>{SIGNAL_META[e.senal].label}</span>
                    {e.fuentes?.length ? ` · ${e.fuentes.join(" · ")}` : ""}
                  </p>
                  <p className="text-xs text-fg">{e.movimiento}</p>
                  <p className="text-xs text-fg-muted">
                    <span className="font-medium">Lectura:</span> {e.lectura}
                  </p>
                  {e.evidencia?.length ? <p className="break-all font-mono text-[9px] text-fg-muted">{e.evidencia.map(corta).join(" · ")}</p> : null}
                </div>
              ))}
            </div>
          ))
        ) : (
          <Vacio>Sin movimientos registrados en este periodo.</Vacio>
        )}
      </Seccion>

      <Seccion titulo="Evolución">
        {m.serie.length > 0 && (
          <Tabla
            cols={["Corrida", "Seguidores", "Posts vistos", "ER prom."]}
            derecha={[1, 2, 3]}
            filas={m.serie.map((s) => [<span className="font-mono" key="c" title={s.corrida}>{fmtFecha(s.fecha)}</span>, fmtInt(s.seguidores), s.posts, fmtEr(s.erPromedio)])}
          />
        )}
        {d.evolucion.length > 0 ? (
          <Tabla
            cols={["Corrida", "Nuevo", "Confuso", "Sin datos", "No funciona", "% con evidencia"]}
            derecha={[1, 2, 3, 4, 5]}
            filas={d.evolucion.map((p) => [
              <span className="font-mono" key="c">{p.corridaId}</span>,
              p.conteo.nuevo,
              p.conteo.confuso,
              p.conteo["sin-datos"],
              p.conteo["no-funciona"],
              fmtPct(p.pctConEvidencia, { scaled: true }),
            ])}
          />
        ) : (
          m.serie.length === 0 && <Vacio>Sin corridas en este periodo.</Vacio>
        )}
      </Seccion>
    </article>
  );
}
