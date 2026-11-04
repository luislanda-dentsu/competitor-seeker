import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { competidoresActivos, listarCorridas, listarMarcas } from "@competitor-seeker/core";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { CorridasView } from "@/components/app/runs/CorridasView";
import { RunHistoryTable } from "@/components/app/runs/RunHistoryTable";
import { apifyParaUi } from "@/lib/runs/apify";
import { marcaActiva } from "@/lib/runs/consulta";
import { estadoRunner } from "@/lib/runs/runner";
import type { MarcaUi } from "@/lib/runs/tipos";

import Loading from "./loading";

export const metadata = { title: "Corridas" };

function SinMarcas(): React.ReactElement {
  return (
    <Empty className="rounded-lg border border-border bg-card">
      <EmptyHeader>
        <EmptyTitle className="text-base font-medium">No hay marcas</EmptyTitle>
        <EmptyDescription>Sin una marca con competidores no hay nada que correr. Da de alta la primera en Ajustes.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href="/ajustes" />} size="sm" variant="outline">
          Ir a Ajustes
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/** Lee cookies y archivos: va dentro de Suspense (cacheComponents). */
async function CorridasContenido(): Promise<React.ReactElement> {
  await connection();
  const marcas = listarMarcas();
  if (marcas.length === 0) return <SinMarcas />;
  const activa = (await marcaActiva(marcas)) ?? marcas[0]!;
  const marcasUi: MarcaUi[] = marcas.map((m) => {
    const activos = competidoresActivos(m);
    return { slug: m.slug, nombre: m.nombre, competidores: activos.length, perfilesIg: activos.filter((c) => c.instagram).length };
  });
  const { corridas, invalidas } = listarCorridas(activa.slug);
  const { enCurso } = estadoRunner();

  return (
    <div className="flex flex-col gap-4">
      <CorridasView apify={apifyParaUi()} enCurso={enCurso} marcaInicial={activa.slug} marcas={marcasUi} />
      <RunHistoryTable corridas={corridas} invalidas={invalidas.length} />
    </div>
  );
}

export default function CorridasPage(): React.ReactElement {
  return (
    <Suspense fallback={<Loading />}>
      <CorridasContenido />
    </Suspense>
  );
}
