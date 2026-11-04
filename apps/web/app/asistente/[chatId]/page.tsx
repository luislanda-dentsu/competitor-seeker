import { Suspense } from "react";
import { esIdChatValido } from "@competitor-seeker/core";
import { CargandoChat, ChatNoEncontrado, SinMarcas } from "@/components/app/chat/ChatPageStates";
import { ChatView } from "@/components/app/chat/ChatView";
import { cargarChat, cargarDatosAsistente } from "@/lib/chat/pagina";

export const metadata = { title: "Asistente" };

async function ChatContenido({ chatId }: { chatId: string }): Promise<React.ReactElement> {
  const datos = await cargarDatosAsistente();
  if (!datos) return <SinMarcas />;
  const chat = esIdChatValido(chatId) ? cargarChat(datos.marca, chatId) : null;
  if (!chat) return <ChatNoEncontrado />;
  return <ChatView chat={chat} key={chat.id} marca={datos.marca} marcaNombre={datos.marcaNombre} sinEntradas={datos.sinEntradas} sugerencias={datos.sugerencias} />;
}

export default async function ChatPage({ params }: PageProps<"/asistente/[chatId]">): Promise<React.ReactElement> {
  const { chatId } = await params;
  return (
    <Suspense fallback={<CargandoChat />}>
      <ChatContenido chatId={chatId} />
    </Suspense>
  );
}
