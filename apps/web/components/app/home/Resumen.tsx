import { Download, FolderOpen, Play } from "lucide-react";
import { after } from "next/server";
import { pullSiToca } from "@competitor-seeker/core";
import { ActividadCompetidorCard } from "@/components/app/home/ActividadCompetidorCard";
import { KpiCard } from "@/components/app/kpi/KpiCard";
import { PeriodoSelector } from "@/components/app/periodo/PeriodoSelector";
import { EmptyState } from "@/components/app/states/EmptyState";
import { LogAlert } from "@/components/app/states/LogAlert";
import { Button } from "@/components/ui/button";
import { getMarcaActiva } from "@/lib/brand";
import { cargarActividad } from "@/lib/data/actividad";
import { cargarDatosMarca, type DatosMarca } from "@/lib/data/marca";
import { fmtFecha } from "@/lib/format";
import { periodoDeRequest } from "@/lib/periodo-servidor";

function etiquetaUltimaCorrida(datos: DatosMarca): string {
  const u = datos.kpis.ultimaCorrida;
  if (!u) return "sin corridas";
  if (u.modo === "migrada") return "migrada";
  if (!u.verificado) return "sin verificar";
  return `verificada · ${u.intentos} ${u.intentos === 1 ? "intento" : "intentos"}`;
}

function Kpis({ datos }: { datos: DatosMarca }): React.ReactElement {
  const { kpis } = datos;
  return (
    <section
      aria-label="Indicadores"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
    >
      <KpiCard
        hint="En la lista de vigilancia de la marca"
        label="Competidores vigilados"
        value={kpis.competidoresVigilados}
      />
      <KpiCard
        delta={kpis.deltaVsAnterior}
        deltaLabel={kpis.deltaVsAnterior === null ? "sin anterior" : undefined}
        hint="Señal nuevo en la última corrida"
        label="Movimientos nuevos"
        value={kpis.movimientosNuevosUltimaCorrida}
      />
      <KpiCard
        decimals={kpis.pctConEvidencia % 1 === 0 ? 0 : 1}
        hint="Entradas con señal distinta de sin-datos"
        label="% con evidencia"
        suffix="%"
        value={kpis.pctConEvidencia}
      />
      <KpiCard
        deltaLabel={etiquetaUltimaCorrida(datos)}
        hint={kpis.ultimaCorrida ? kpis.ultimaCorrida.id : "Todavía no hay corridas"}
        label="Última corrida"
        value={0}
        valueText={fmtFecha(kpis.ultimaCorrida?.fecha)}
      />
    </section>
  );
}

/**
 * Isla de datos de la Home. Lee cookie (marca activa) y disco: va dentro
 * de un Suspense en app/page.tsx. Estados: sin marcas → Empty a Ajustes;
 * marca sin entradas → Empty "Correr ahora"; log con líneas ilegibles →
 * Alert (sin ocultar los datos legibles).
 */
export async function Resumen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  // Pull de fondo (throttle 60 s) sin bloquear el render; nunca lanza.
  after(() => {
    void pullSiToca().catch(() => undefined);
  });
  const slug = await getMarcaActiva();
  if (!slug) {
    return (
      <EmptyState
        accion={{ href: "/ajustes", label: "Dar de alta una marca" }}
        descripcion="No hay ninguna carpeta válida en marcas/. Crea la primera marca con su lista de vigilancia."
        icon={FolderOpen}
        titulo="Sin marcas"
      />
    );
  }
  const periodo = await periodoDeRequest(searchParams);
  const datos = cargarDatosMarca(slug);
  const { entradas, kpis, lineasInvalidas } = datos;

  const alerta = (
    <LogAlert
      corridasInvalidas={datos.corridasInvalidas.length}
      entradasSinCorrida={datos.entradasSinCorrida}
      lineas={lineasInvalidas}
    />
  );

  if (entradas.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {alerta}
        <EmptyState
          accion={{ href: "/corridas", label: "Correr ahora" }}
          descripcion={`${datos.marca.nombre} vigila ${kpis.competidoresVigilados} ${kpis.competidoresVigilados === 1 ? "competidor" : "competidores"} y todavía no tiene movimientos registrados.`}
          icon={Play}
          secundaria={{ href: "/ajustes", label: "Revisar la lista de vigilancia" }}
          titulo="Sin movimientos registrados"
        />
      </div>
    );
  }

  const actividad = cargarActividad(slug, periodo);
  const conPosts = actividad.filter((a) => a.metricas.posts > 0).length;

  return (
    <div className="flex flex-col gap-4">
      {alerta}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-sm text-fg-muted">{datos.marca.nombre}</p>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodoSelector periodo={periodo} />
          <Button render={<a download href={`/api/marcas/${encodeURIComponent(slug)}/export`} />} size="sm" variant="outline">
            <Download aria-hidden="true" />
            Exportar HTML
          </Button>
        </div>
      </div>
      <Kpis datos={datos} />

      <section aria-labelledby="actividad-titulo" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="t-label" id="actividad-titulo">
            Actividad por competidor
          </h2>
          <span className="text-xs text-fg-muted">
            {periodo.etiqueta} · {conPosts} de {actividad.length} con publicaciones
          </span>
        </div>
        {actividad.length === 0 ? (
          <p className="text-sm text-fg-muted">No hay competidores activos en la lista de vigilancia.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {actividad.map((a) => (
              <ActividadCompetidorCard actividad={a} key={a.competidor.slug} query={periodo.query} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
