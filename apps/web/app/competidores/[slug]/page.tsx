import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { metricasCompetidor } from "@competitor-seeker/core";
import { CompetitorHeader } from "@/components/app/competitor/CompetitorHeader";
import { CompetitorTabs } from "@/components/app/competitor/CompetitorTabs";
import { PeriodoSelector } from "@/components/app/periodo/PeriodoSelector";
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
import { periodoDeRequest } from "@/lib/periodo-servidor";
import Loading from "./loading";

export const metadata = { title: "Competidor" };

async function Ficha({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: PageProps<"/competidores/[slug]">["searchParams"];
}): Promise<React.ReactElement> {
  const marca = await getMarcaActiva();
  if (!marca) notFound();
  const datos = cargarCompetidor(marca, slug);
  if (!datos) notFound();
  const periodo = await periodoDeRequest(searchParams);
  const { lineasInvalidas, corridasInvalidas, entradasSinCorrida, corridas } = cargarDatosMarca(marca);
  const metricas = metricasCompetidor(corridas, datos.competidor.nombre, { periodo });
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={datos.competidor.nombre} />
      <div className="flex flex-wrap items-center justify-between gap-2">
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
      <PeriodoSelector periodo={periodo} />
      </div>
      <LogAlert
        corridasInvalidas={corridasInvalidas.length}
        entradasSinCorrida={entradasSinCorrida}
        lineas={lineasInvalidas}
      />
      <CompetitorHeader datos={datos} />
      <CompetitorTabs datos={datos} metricas={metricas} periodo={periodo.etiqueta} />
    </div>
  );
}

export default async function CompetidorPage({
  params,
  searchParams,
}: PageProps<"/competidores/[slug]">): Promise<React.ReactElement> {
  const { slug } = await params;
  return (
    <Suspense fallback={<Loading />}>
      <Ficha searchParams={searchParams} slug={slug} />
    </Suspense>
  );
}
