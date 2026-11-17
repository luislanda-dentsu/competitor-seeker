import { FileDown, FolderOpen, Users } from "lucide-react";
import { Suspense } from "react";
import { CompetitorList } from "@/components/app/home/CompetitorList";
import { PeriodoSelector } from "@/components/app/periodo/PeriodoSelector";
import { EmptyState } from "@/components/app/states/EmptyState";
import { LogAlert } from "@/components/app/states/LogAlert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { getMarcaActiva } from "@/lib/brand";
import { cargarDatosMarca } from "@/lib/data/marca";
import { periodoDeRequest } from "@/lib/periodo-servidor";
import Loading from "./loading";

export const metadata = { title: "Competidores" };

async function Indice({ searchParams }: { searchParams: PageProps<"/competidores">["searchParams"] }): Promise<React.ReactElement> {
  const slug = await getMarcaActiva();
  if (!slug) {
    return (
      <EmptyState
        accion={{ href: "/ajustes", label: "Dar de alta una marca" }}
        descripcion="No hay ninguna marca válida en marcas/."
        icon={FolderOpen}
        titulo="Sin marcas"
      />
    );
  }
  const datos = cargarDatosMarca(slug);
  if (datos.competidores.length === 0) {
    return (
      <EmptyState
        accion={{ href: "/ajustes", label: "Añadir competidores" }}
        descripcion={`${datos.marca.nombre} no tiene competidores en su lista de vigilancia.`}
        icon={Users}
        titulo="Sin competidores"
      />
    );
  }
  const periodo = await periodoDeRequest(searchParams);
  return (
    <div className="flex flex-col gap-4">
      {/* Exportar: todas las fichas del periodo elegido en un solo PDF (se abre en pestaña nueva). */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <PeriodoSelector periodo={periodo} />
        <Button
          render={<a href={`/informe?marca=${encodeURIComponent(slug)}&${periodo.query}&imprimir=1`} rel="noopener" target="_blank" />}
          size="sm"
          title={`Informe PDF de todos los competidores · ${periodo.etiqueta}`}
          variant="outline"
        >
          <FileDown aria-hidden="true" />
          Exportar PDF
        </Button>
      </div>
      <LogAlert
        corridasInvalidas={datos.corridasInvalidas.length}
        entradasSinCorrida={datos.entradasSinCorrida}
        lineas={datos.lineasInvalidas}
      />
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="t-label">
            {datos.marca.nombre} · {datos.competidores.length}{" "}
            {datos.competidores.length === 1 ? "competidor" : "competidores"}
          </CardTitle>
        </CardHeader>
        <CardPanel className="p-5 pt-0">
          <CompetitorList competidores={datos.competidores} />
        </CardPanel>
      </Card>
    </div>
  );
}

export default function CompetidoresPage({ searchParams }: PageProps<"/competidores">): React.ReactElement {
  return (
    <Suspense fallback={<Loading />}>
      <Indice searchParams={searchParams} />
    </Suspense>
  );
}
