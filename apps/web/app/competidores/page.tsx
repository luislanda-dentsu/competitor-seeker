import { FolderOpen, Users } from "lucide-react";
import { Suspense } from "react";
import { CompetitorList } from "@/components/app/home/CompetitorList";
import { EmptyState } from "@/components/app/states/EmptyState";
import { LogAlert } from "@/components/app/states/LogAlert";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { getMarcaActiva } from "@/lib/brand";
import { cargarDatosMarca } from "@/lib/data/marca";
import Loading from "./loading";

export const metadata = { title: "Competidores" };

async function Indice(): Promise<React.ReactElement> {
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
  return (
    <div className="flex flex-col gap-4">
      <LogAlert corridasInvalidas={datos.corridasInvalidas.length} lineas={datos.lineasInvalidas} />
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

export default function CompetidoresPage(): React.ReactElement {
  return (
    <Suspense fallback={<Loading />}>
      <Indice />
    </Suspense>
  );
}
