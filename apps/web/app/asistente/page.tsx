import { Suspense } from "react";
import { CargandoChat, SinMarcas } from "@/components/app/chat/ChatPageStates";
import { ChatView } from "@/components/app/chat/ChatView";
import { cargarDatosAsistente } from "@/lib/chat/pagina";

export const metadata = { title: "Asistente" };

/** Lee cookie (marca activa) y disco: va dentro de Suspense (cacheComponents). */
async function AsistenteContenido(): Promise<React.ReactElement> {
  const datos = await cargarDatosAsistente();
  if (!datos) return <SinMarcas />;
  return <ChatView chat={null} key={datos.marca} marca={datos.marca} marcaNombre={datos.marcaNombre} sinEntradas={datos.sinEntradas} sugerencias={datos.sugerencias} />;
}

export default function AsistentePage(): React.ReactElement {
  return (
    <Suspense fallback={<CargandoChat />}>
      <AsistenteContenido />
    </Suspense>
  );
}
