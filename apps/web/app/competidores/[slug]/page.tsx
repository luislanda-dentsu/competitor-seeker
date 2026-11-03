import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompetitorHeader } from "@/components/app/competitor/CompetitorHeader";
import { CompetitorTabs } from "@/components/app/competitor/CompetitorTabs";
import { PageTitle } from "@/components/app/shell/PageTitle";
import { LogAlert } from "@/components/app/states/LogAlert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getMarcaActiva } from "@/lib/brand";
import { cargarCompetidor } from "@/lib/data/competidor";
import { cargarDatosMarca } from "@/lib/data/marca";
import Loading from "./loading";

export const metadata = { title: "Competidor" };

async function Ficha({ slug }: { slug: string }): Promise<React.ReactElement> {
  const marca = await getMarcaActiva();
  if (!marca) notFound();
  const datos = cargarCompetidor(marca, slug);
  if (!datos) notFound();
  const { lineasInvalidas, corridasInvalidas, entradasSinCorrida } = cargarDatosMarca(marca);
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={datos.competidor.nombre} />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Resumen</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/competidores" />}>Competidores</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{datos.competidor.nombre}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <LogAlert
        corridasInvalidas={corridasInvalidas.length}
        entradasSinCorrida={entradasSinCorrida}
        lineas={lineasInvalidas}
      />
      <CompetitorHeader datos={datos} />
      <CompetitorTabs datos={datos} />
    </div>
  );
}

export default async function CompetidorPage({
  params,
}: PageProps<"/competidores/[slug]">): Promise<React.ReactElement> {
  const { slug } = await params;
  return (
    <Suspense fallback={<Loading />}>
      <Ficha slug={slug} />
    </Suspense>
  );
}
