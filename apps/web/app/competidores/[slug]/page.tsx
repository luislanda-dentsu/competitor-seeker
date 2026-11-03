import { PageTitle } from "@/components/app/shell/PageTitle";
import { UnderConstruction } from "@/components/app/states/UnderConstruction";

export const metadata = { title: "Competidor" };

export default async function CompetidorPage({
  params,
}: PageProps<"/competidores/[slug]">) {
  const { slug } = await params;
  return (
    <>
      <PageTitle title={slug} />
      <UnderConstruction
        detalle={`Histórico, evolución y métricas de Instagram de "${slug}". Un slug desconocido devolverá 404 con enlace a Ajustes.`}
        fase={4}
        titulo="Ficha de competidor"
      />
    </>
  );
}
