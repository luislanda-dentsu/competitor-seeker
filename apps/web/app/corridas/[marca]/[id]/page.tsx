import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { entradasPorCompetidor, type Corrida } from "@competitor-seeker/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActions } from "@/components/app/runs/ConfirmActions";
import { agruparObjeciones } from "@/lib/runs/objeciones";
import { EstadoBadge } from "@/components/app/runs/EstadoBadge";
import { RunConsoleView } from "@/components/app/runs/RunConsole";
import { SignalBadge } from "@/components/app/signals/SignalBadge";
import { fmtDur, fmtFecha } from "@/lib/format";
import { reducirTodo } from "@/lib/runs/consola";
import { buscarCorrida, eventosGrabados } from "@/lib/runs/consulta";
import { resumenDeCorrida } from "@/lib/runs/resumen";
import { esIdCorridaValido, esSlugMarcaValido } from "@/lib/runs/rutas";

export const metadata = { title: "Corrida" };

function Dato({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="t-label">{label}</dt>
      <dd className="min-w-0 truncate text-sm text-fg">{children}</dd>
    </div>
  );
}

function Meta({ c }: { c: Corrida }): React.ReactElement {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row flex-wrap items-center gap-3">
        <CardTitle className="font-mono text-base font-medium">{c.id}</CardTitle>
        <EstadoBadge estado={c.estado} />
        {c.estado === "pendiente-confirmacion" && (
          <span className="ms-auto">
            <ConfirmActions corridaId={c.id} intentos={c.intentos} marca={c.marca} objeciones={c.objeciones} />
          </span>
        )}
      </CardHeader>
      <CardPanel>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
          <Dato label="Marca">{c.marca}</Dato>
          <Dato label="Fecha">{fmtFecha(c.fecha)}</Dato>
          <Dato label="Corrida anterior">{c.ultimaCorrida ? fmtFecha(c.ultimaCorrida) : "ninguna"}</Dato>
          <Dato label="Duración">{fmtDur(c.duracionMs)}</Dato>
          <Dato label="Verificación">{c.verificado ? `sí · intento ${c.intentos}` : `no · ${c.intentos} intentos`}</Dato>
          <Dato label="Entradas">{c.entradas.length}</Dato>
          <Dato label="Modo">{c.modo}</Dato>
          <Dato label="Máquina">{c.maquina}</Dato>
          <Dato label="Fuentes">{c.fuentes.length ? c.fuentes.join(", ") : "—"}</Dato>
          <Dato label="Apify">
            {c.apify ? (c.apify.omitido ? `omitido${c.apify.motivo ? ` · ${c.apify.motivo}` : ""}` : `${c.apify.resultados} resultados · $${c.apify.costeEstimadoUsd.toFixed(2)}`) : "—"}
          </Dato>
          <Dato label="Instagram">{c.ig?.sesion ?? "—"}</Dato>
          <Dato label="Competidores">{c.competidores.length ? c.competidores.join(", ") : "—"}</Dato>
        </dl>
        {c.error && (
          <p className="mt-4 rounded-md bg-s-no-funciona-soft px-3 py-2 text-sm text-s-no-funciona">
            <span className="font-medium">Error:</span> {c.error}
          </p>
        )}
        {c.sessionId && <p className="mt-3 font-mono text-xs text-fg-dim">sesión {c.sessionId}</p>}
      </CardPanel>
    </Card>
  );
}

function Objeciones({ c }: { c: Corrida }): React.ReactElement | null {
  if (c.objeciones.length === 0) return null;
  const grupos = agruparObjeciones(c.objeciones);
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="t-label">Objeciones del verificador</CardTitle>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        {grupos.map((g) => (
          <div className="flex flex-col gap-2" key={g.marca}>
            <div className="flex items-center gap-2 text-sm font-medium text-fg">
              {g.marca}
              <Badge variant="warning">{g.problemas.length}</Badge>
            </div>
            <ul className="flex flex-col gap-1.5 ps-5">
              {g.problemas.map((p, i) => (
                <li className="list-disc text-sm text-fg-muted" key={i}>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardPanel>
    </Card>
  );
}

function Entradas({ c }: { c: Corrida }): React.ReactElement {
  const grupos = [...entradasPorCompetidor(c.entradas)];
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="t-label">Entradas de esta corrida</CardTitle>
      </CardHeader>
      <CardPanel className="flex flex-col gap-6">
        {grupos.length === 0 && <p className="text-sm text-fg-muted">Esta corrida no produjo entradas.</p>}
        {grupos.map(([competidor, entradas]) => (
          <section aria-label={competidor} className="flex flex-col gap-3" key={competidor}>
            <h3 className="text-sm font-medium text-fg">{competidor}</h3>
            <ol className="flex flex-col gap-3">
              {entradas.map((e) => (
                <li className="flex flex-col gap-1.5 rounded-md border border-border bg-card-2/60 p-3" key={e.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <SignalBadge senal={e.senal} size="sm" />
                    <span className="text-xs text-fg-muted">{fmtFecha(e.fecha)}</span>
                    {e.fuentes?.map((f) => (
                      <Badge key={f} size="sm" variant="outline">
                        {f}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-fg">{e.movimiento}</p>
                  <p className="text-sm text-fg-muted">{e.lectura}</p>
                  {e.evidencia && e.evidencia.length > 0 && (
                    <ul className="flex flex-wrap gap-x-3 gap-y-1">
                      {e.evidencia.map((u) => (
                        <li key={u}>
                          <a className="inline-flex items-center gap-1 text-xs text-chart-6 underline-offset-4 hover:underline" href={u} rel="noreferrer" target="_blank">
                            <ExternalLink aria-hidden="true" className="size-3" />
                            {new URL(u).hostname}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </CardPanel>
    </Card>
  );
}

async function Detalle({ marca, id }: { marca: string; id: string }): Promise<React.ReactElement> {
  await connection();
  if (!esSlugMarcaValido(marca) || !esIdCorridaValido(id)) notFound();
  const corrida = buscarCorrida(marca, id);
  if (!corrida) notFound();
  const eventos = eventosGrabados(marca, id);
  const consola = eventos ? reducirTodo(eventos, corrida.estado === "en-curso" ? null : resumenDeCorrida(corrida)) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button render={<Link href="/corridas" />} size="sm" variant="ghost">
          <ArrowLeft aria-hidden="true" />
          Corridas
        </Button>
      </div>
      <Meta c={corrida} />
      <Objeciones c={corrida} />
      <Entradas c={corrida} />
      {consola && (
        <section aria-label="Consola grabada" className="flex flex-col gap-2">
          <h2 className="t-label">Consola grabada</h2>
          <RunConsoleView consola={consola} fecha={corrida.fecha} marca={corrida.marca} tiempo={fmtDur(corrida.duracionMs)} />
        </section>
      )}
    </div>
  );
}

export default async function CorridaPage({ params }: { params: Promise<{ marca: string; id: string }> }): Promise<React.ReactElement> {
  const { marca, id } = await params;
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      }
    >
      <Detalle id={id} marca={marca} />
    </Suspense>
  );
}
