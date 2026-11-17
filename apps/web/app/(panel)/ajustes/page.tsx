import { connection } from "next/server";
import { Suspense } from "react";
import { SettingsView } from "@/components/app/settings/SettingsView";
import { cargarDatosAjustes } from "@/lib/settings/datos";

import Loading from "./loading";

export const metadata = { title: "Ajustes" };

/** Lee cookies y archivos: va dentro de Suspense (cacheComponents). */
async function AjustesContenido(): Promise<React.ReactElement> {
  await connection();
  const datos = await cargarDatosAjustes();
  return <SettingsView datos={datos} />;
}

export default function AjustesPage(): React.ReactElement {
  return (
    <Suspense fallback={<Loading />}>
      <AjustesContenido />
    </Suspense>
  );
}
