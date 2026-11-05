import type { MetricasCompetidor } from "@competitor-seeker/core";
import { BarChart3 } from "lucide-react";
import { EstrategiaTab } from "@/components/app/competitor/EstrategiaTab";
import { HistoricoTab } from "@/components/app/competitor/HistoricoTab";
import { LecturaTab } from "@/components/app/competitor/LecturaTab";
import { PostMetricsTable } from "@/components/app/competitor/PostMetricsTable";
import { PublicacionesTabla } from "@/components/app/competitor/PublicacionesTabla";
import { RendimientoTab } from "@/components/app/competitor/RendimientoTab";
import { SignalStrip } from "@/components/app/competitor/SignalStrip";
import { EmptyState } from "@/components/app/states/EmptyState";
import { Card, CardPanel } from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { DatosCompetidor } from "@/lib/data/competidor";

function Contador({ n }: { n: number }): React.ReactElement | null {
  if (!n) return null;
  return <span className="ms-1 font-mono text-[11px] tabular-nums text-fg-dim">{n}</span>;
}

/**
 * Análisis profundo de un competidor: Rendimiento · Publicaciones · Lectura ·
 * Estrategia (IA) · Movimientos · Evolución. Las cuatro primeras siguen el periodo.
 */
export function CompetitorTabs({
  datos,
  metricas,
  periodo,
}: {
  datos: DatosCompetidor;
  metricas: MetricasCompetidor;
  periodo: string;
}): React.ReactElement {
  const legado = metricas.publicaciones.length === 0 && datos.conMetricas.length > 0;
  return (
    <Card>
      <CardPanel className="p-5">
        <Tabs className="gap-4" defaultValue="rendimiento">
          {/* En móvil la fila desliza: el borde derecho se desvanece para indicar que hay más pestañas. */}
          <div className="-mx-1 overflow-x-auto px-1 [mask-image:linear-gradient(to_right,#000_80%,transparent)] [scrollbar-width:none] lg:[mask-image:none]">
            <TabsList aria-label="Secciones de la ficha" className="justify-start">
              <TabsTab value="rendimiento">Rendimiento</TabsTab>
              <TabsTab value="publicaciones">
                Publicaciones
                <Contador n={metricas.publicaciones.length} />
              </TabsTab>
              <TabsTab value="lectura">
                Lectura
                <Contador n={metricas.lecturas.length} />
              </TabsTab>
              <TabsTab value="estrategia">Estrategia (IA)</TabsTab>
              <TabsTab value="historico">Movimientos</TabsTab>
              <TabsTab value="evolucion">Evolución</TabsTab>
            </TabsList>
          </div>
          {/* keepMounted: los filtros de Movimientos sobreviven al cambio de pestaña. */}
          <TabsPanel value="rendimiento">
            <RendimientoTab m={metricas} periodo={periodo} />
          </TabsPanel>
          <TabsPanel value="publicaciones">
            {metricas.publicaciones.length > 0 ? (
              <PublicacionesTabla publicaciones={metricas.publicaciones} />
            ) : legado ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-fg-muted">Corridas anteriores a la v2.1: cifras de Apify por movimiento, no por publicación (todo el histórico).</p>
                <PostMetricsTable entradas={datos.conMetricas} />
              </div>
            ) : (
              <EmptyState
                accion={{ href: "/corridas", label: "Ir a Corridas" }}
                descripcion="No hay publicaciones registradas en este periodo. Amplía el periodo o lanza una corrida."
                icon={BarChart3}
                plano
                titulo="Sin publicaciones"
              />
            )}
          </TabsPanel>
          <TabsPanel value="lectura">
            <LecturaTab lecturas={metricas.lecturas} />
          </TabsPanel>
          <TabsPanel value="estrategia">
            <EstrategiaTab lecturas={metricas.lecturas} />
          </TabsPanel>
          <TabsPanel keepMounted value="historico">
            <HistoricoTab conteo={datos.conteo} grupos={datos.grupos} />
          </TabsPanel>
          <TabsPanel keepMounted value="evolucion">
            <SignalStrip evolucion={datos.evolucion} />
          </TabsPanel>
        </Tabs>
      </CardPanel>
    </Card>
  );
}
