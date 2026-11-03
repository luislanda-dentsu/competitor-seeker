import { FolderOpen, Play } from "lucide-react";
import { FunnelBars } from "@/components/app/charts/FunnelBars";
import { SignalDistribution } from "@/components/app/charts/SignalDistribution";
import { SignalTrendChart } from "@/components/app/charts/SignalTrendChart";
import { CompetitorList } from "@/components/app/home/CompetitorList";
import { RunTimeline } from "@/components/app/home/RunTimeline";
import { KpiCard } from "@/components/app/kpi/KpiCard";
import { EmptyState } from "@/components/app/states/EmptyState";
import { LogAlert } from "@/components/app/states/LogAlert";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { getMarcaActiva } from "@/lib/brand";
import { cargarDatosMarca, type DatosMarca } from "@/lib/data/marca";
import { fmtFecha } from "@/lib/format";

function Seccion({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <Card className={className} data-section={titulo}>
      <CardHeader className="p-5 pb-3">
        <CardTitle className="t-label">{titulo}</CardTitle>
      </CardHeader>
      <CardPanel className="flex flex-col p-5 pt-0">{children}</CardPanel>
    </Card>
  );
}

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
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
        suffix=" %"
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
export async function Resumen(): Promise<React.ReactElement> {
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
  const datos = cargarDatosMarca(slug);
  const { entradas, kpis, conteo, serie, competidores, lineasInvalidas } = datos;

  const alerta = (
    <LogAlert corridasInvalidas={datos.corridasInvalidas.length} lineas={lineasInvalidas} />
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

  const conEvidencia = entradas.filter((e) => e.senal !== "sin-datos").length;
  const etapas = [
    { label: "Competidores", n: kpis.competidoresVigilados, pct: 100 },
    { label: "Entradas", n: entradas.length, pct: 100 },
    { label: "Con evidencia", n: conEvidencia, pct: (conEvidencia / entradas.length) * 100 },
    { label: "Nuevos", n: conteo.nuevo, pct: (conteo.nuevo / entradas.length) * 100 },
  ];

  return (
    <div className="flex flex-col gap-4">
      {alerta}
      <Kpis datos={datos} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Seccion className="lg:col-span-8" titulo="Tendencia de señales">
          <SignalTrendChart serie={serie} />
        </Seccion>
        <Seccion className="lg:col-span-4" titulo="Distribución">
          <SignalDistribution conteo={conteo} pctConEvidencia={kpis.pctConEvidencia} />
        </Seccion>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Seccion className="lg:col-span-4" titulo="Cadena de evidencia">
          <FunnelBars etapas={etapas} />
        </Seccion>
        <Seccion className="lg:col-span-8" titulo="Competidores">
          <CompetitorList competidores={competidores} />
        </Seccion>
      </div>

      <Seccion titulo="Corridas">
        <RunTimeline serie={serie} />
      </Seccion>
    </div>
  );
}
