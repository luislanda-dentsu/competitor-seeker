import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsView } from "@/components/app/settings/SettingsView";
import { cargarDatosAjustes } from "@/lib/settings/datos";

export const metadata = { title: "Ajustes" };

/** Lee cookies y archivos: va dentro de Suspense (cacheComponents). */
async function AjustesContenido(): Promise<React.ReactElement> {
  await connection();
  const datos = await cargarDatosAjustes();
  return <SettingsView datos={datos} />;
}

function Cargando(): React.ReactElement {
  return (
    <div aria-busy="true" aria-label="Cargando ajustes" className="flex flex-col gap-4 md:flex-row md:gap-6">
      <div className="flex w-full flex-col gap-2 md:w-52">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton className="h-8 w-full" key={i} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export default function AjustesPage(): React.ReactElement {
  return (
    <Suspense fallback={<Cargando />}>
      <AjustesContenido />
    </Suspense>
  );
}
