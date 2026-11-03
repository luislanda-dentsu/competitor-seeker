// Solo servidor: datos de la página del asistente (marca activa, sugerencias, chat).
import { leerChat, leerLog, leerMarca } from "@competitor-seeker/core";
import { getMarcaActiva } from "@/lib/brand";
import { chatAUi, indiceLog } from "@/lib/chat/resolver";
import { sugerenciasDe } from "@/lib/chat/sugerencias";
import type { ChatUi, Sugerencia } from "@/lib/chat/tipos";

export interface DatosAsistente {
  marca: string;
  marcaNombre: string;
  sugerencias: Sugerencia[];
  sinEntradas: boolean;
}

/** Marca activa + sugerencias derivadas del log. Null si no hay marcas. */
export async function cargarDatosAsistente(): Promise<DatosAsistente | null> {
  const activa = await getMarcaActiva();
  if (!activa) return null;
  const marca = leerMarca(activa);
  const entradas = leerLog(activa).items;
  return { marca: marca.slug, marcaNombre: marca.nombre, sugerencias: sugerenciasDe(entradas), sinEntradas: entradas.length === 0 };
}

/** Chat existente de la marca resuelto para el cliente; null si no existe o es ilegible. */
export function cargarChat(marca: string, chatId: string): ChatUi | null {
  try {
    const chat = leerChat(marca, chatId);
    return chat ? chatAUi(chat, indiceLog(marca)) : null;
  } catch {
    return null;
  }
}
