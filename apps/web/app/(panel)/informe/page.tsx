import { existeMarca, fechaLocal } from "@competitor-seeker/core";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImprimirInforme } from "@/components/app/informe/ImprimirInforme";
import { InformeDocumento } from "@/components/app/informe/InformeDocumento";
import { PageTitle } from "@/components/app/shell/PageTitle";
import { getMarcaActiva } from "@/lib/brand";
import { cargarInforme } from "@/lib/data/informe";
import { periodoDeRequest } from "@/lib/periodo-servidor";

export const metadata = { title: "Informe" };

async function Contenido({ searchParams }: { searchParams: PageProps<"/informe">["searchParams"] }): Promise<React.ReactElement> {
  const [periodo, params] = await Promise.all([periodoDeRequest(searchParams), searchParams]);
  // ?marca= fija la marca del enlace (otra pestaña puede haber cambiado la cookie); si no, la activa.
  const pedida = typeof params.marca === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.marca) ? params.marca : null;
  const marca = pedida && existeMarca(pedida) ? pedida : await getMarcaActiva();
  if (!marca) notFound();
  const informe = cargarInforme(marca, periodo);
  const generado = fechaLocal(new Date());
  const tramo = periodo.desde && periodo.hasta ? `${periodo.desde} a ${periodo.hasta}` : periodo.etiqueta;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Informe" />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-fg-muted">
          {informe.marca.nombre} · {periodo.etiqueta}. En el diálogo elige «Guardar como PDF».
        </p>
        <ImprimirInforme auto={params.imprimir === "1"} nombreArchivo={`Informe competencia ${informe.marca.nombre} ${tramo}`} />
      </div>
      <InformeDocumento etiquetaPeriodo={periodo.etiqueta} generado={generado} informe={informe} />
    </div>
  );
}

/** Informe imprimible (PDF) de todos los competidores de la marca activa en el periodo de la URL. */
export default function InformePage({ searchParams }: PageProps<"/informe">): React.ReactElement {
  return (
    <Suspense fallback={<p className="text-sm text-fg-muted">Preparando el informe…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}
