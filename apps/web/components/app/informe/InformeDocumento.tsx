import { InformeCompetidor } from "@/components/app/informe/InformeCompetidor";
import { fmtEr } from "@/components/app/metricas/etiquetas";
import type { Informe } from "@/lib/data/informe";
import { fmtFecha, fmtInt } from "@/lib/format";

/** Documento completo: portada con el comparativo y una ficha por competidor (cada una en página nueva). */
export function InformeDocumento({ informe, etiquetaPeriodo, generado }: { informe: Informe; etiquetaPeriodo: string; generado: string }): React.ReactElement {
  const { periodo } = informe;
  const rango = periodo.desde && periodo.hasta ? `${fmtFecha(periodo.desde)} – ${fmtFecha(periodo.hasta)}` : etiquetaPeriodo;
  return (
    <div className="informe mx-auto flex w-full max-w-[210mm] flex-col gap-10 rounded-[var(--radius)] p-8 print:max-w-none print:rounded-none print:p-0">
      <header className="flex flex-col gap-1 border-b border-border-strong pb-4">
        <span className="text-xs font-medium tracking-wide text-fg-muted uppercase">Informe de competencia</span>
        <h1 className="text-2xl font-semibold">{informe.marca.nombre}</h1>
        <p className="text-sm text-fg-muted">
          Periodo: {rango} · {informe.competidores.length} competidores · generado el {fmtFecha(generado)}
        </p>
        <p className="text-[10px] text-fg-muted">
          Cifras de Apify acumuladas a la fecha de cada corrida. ER aprox. = (likes + comentarios) / seguidores. «—» = sin dato.
        </p>
      </header>

      <section className="informe-seccion flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Comparativo del periodo</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-fg-muted">
              {["Competidor", "Posts", "Posts/sem.", "Likes", "Coment.", "Vistas", "ER prom.", "Seguidores", "Movim."].map((c, i) => (
                <th className={`border-b border-border-strong py-1 pe-2 font-medium ${i ? "text-right" : "text-left"}`} key={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {informe.competidores.map(({ competidor, metricas: m, movimientos }) => (
              <tr className="informe-fila" key={competidor.slug}>
                <td className="border-b border-border py-1 pe-2">{competidor.nombre}</td>
                {[
                  fmtInt(m.posts),
                  m.cadenciaSemanal ?? "—",
                  m.likes.n ? fmtInt(m.likes.total) : "—",
                  m.comentarios.n ? fmtInt(m.comentarios.total) : "—",
                  m.vistas.n ? fmtInt(m.vistas.total) : "—",
                  fmtEr(m.er.promedio),
                  fmtInt(m.seguidores.actual),
                  movimientos.reduce((a, g) => a + g.entradas.length, 0),
                ].map((v, i) => (
                  <td className="border-b border-border py-1 pe-2 text-right font-mono tabular-nums" key={i}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {informe.competidores.map((c, i) => (
        <InformeCompetidor d={c} indice={i + 1} key={c.competidor.slug} />
      ))}
    </div>
  );
}
