import { BarChart3 } from "lucide-react";
import { HistoricoTab } from "@/components/app/competitor/HistoricoTab";
import { PostMetricsTable } from "@/components/app/competitor/PostMetricsTable";
import { SignalStrip } from "@/components/app/competitor/SignalStrip";
import { EmptyState } from "@/components/app/states/EmptyState";
import { Card, CardPanel } from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { DatosCompetidor } from "@/lib/data/competidor";

/** Tabs Histórico · Evolución · Métricas IG de la ficha de competidor. */
export function CompetitorTabs({ datos }: { datos: DatosCompetidor }): React.ReactElement {
  return (
    <Card className="rounded-lg">
      <CardPanel className="p-5">
        <Tabs className="gap-4" defaultValue="historico">
          <TabsList aria-label="Secciones de la ficha">
            <TabsTab value="historico">Histórico</TabsTab>
            <TabsTab value="evolucion">Evolución</TabsTab>
            <TabsTab value="metricas">
              Métricas IG
              {datos.conMetricas.length > 0 && (
                <span className="ms-1 font-mono text-[11px] tabular-nums text-fg-dim">
                  {datos.conMetricas.length}
                </span>
              )}
            </TabsTab>
          </TabsList>
          {/* keepMounted: los filtros del Histórico sobreviven al cambio de pestaña. */}
          <TabsPanel keepMounted value="historico">
            <HistoricoTab conteo={datos.conteo} grupos={datos.grupos} />
          </TabsPanel>
          <TabsPanel keepMounted value="evolucion">
            <SignalStrip evolucion={datos.evolucion} />
          </TabsPanel>
          <TabsPanel keepMounted value="metricas">
            {datos.conMetricas.length > 0 ? (
              <PostMetricsTable entradas={datos.conMetricas} />
            ) : (
              <EmptyState
                accion={{ href: "/corridas", label: "Ir a Corridas" }}
                descripcion="Sin métricas de Apify todavía. Actívalo en la próxima corrida para ver likes, comentarios y vistas por publicación."
                icon={BarChart3}
                plano
                titulo="Sin métricas de Instagram"
              />
            )}
          </TabsPanel>
        </Tabs>
      </CardPanel>
    </Card>
  );
}
