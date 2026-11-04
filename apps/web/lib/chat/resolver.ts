// Solo servidor: resuelve los ids citados por el asistente contra el log y
// convierte chats persistidos a los objetos planos que recibe el cliente.
import { fechaLocal, leerLog, ultimaCorridaRegistrada, type Chat, type Entrada, type MensajeChat } from "@competitor-seeker/core";
import type { ArtefactoUi, ChatUi, EntradaCitada, MensajeUi } from "@/lib/chat/tipos";

export type IndiceLog = Map<string, Entrada>;

export function indiceLog(marca: string): IndiceLog {
  return new Map(leerLog(marca).items.map((e) => [e.id, e]));
}

export function entradaCitada(e: Entrada): EntradaCitada {
  return { id: e.id, marca: e.marca, fecha: e.fecha, senal: e.senal, movimiento: e.movimiento, lectura: e.lectura };
}

/** Artefacto con sus entradas (en el orden citado); los ids desconocidos van a `faltantes`. */
export function resolverArtefacto(titulo: string, ids: readonly string[], indice: IndiceLog): ArtefactoUi {
  const entradas: EntradaCitada[] = [];
  const faltantes: string[] = [];
  for (const id of ids) {
    const e = indice.get(id);
    if (e) entradas.push(entradaCitada(e));
    else faltantes.push(id);
  }
  return { titulo, ids: [...ids], entradas, faltantes };
}

export function mensajeAUi(m: MensajeChat, indice: IndiceLog): MensajeUi {
  return {
    rol: m.rol,
    texto: m.texto,
    ts: m.ts,
    ...(m.artefacto ? { artefacto: resolverArtefacto(m.artefacto.titulo, m.artefacto.ids, indice) } : {}),
    ...(m.feedback ? { feedback: m.feedback } : {}),
  };
}

/** ¿Hay una corrida registrada con fecha posterior al día en que se armó el contexto del chat? */
function corridasNuevas(chat: Chat): boolean {
  const ultima = ultimaCorridaRegistrada(chat.marca);
  if (!ultima) return false;
  return ultima > fechaLocal(new Date(chat.contextoEn ?? chat.creado));
}

export function chatAUi(chat: Chat, indice: IndiceLog = indiceLog(chat.marca)): ChatUi {
  return {
    id: chat.id,
    marca: chat.marca,
    titulo: chat.titulo,
    creado: chat.creado,
    actualizado: chat.actualizado,
    contextoEn: chat.contextoEn ?? chat.creado,
    corridasNuevas: corridasNuevas(chat),
    mensajes: chat.mensajes.map((m) => mensajeAUi(m, indice)),
  };
}
