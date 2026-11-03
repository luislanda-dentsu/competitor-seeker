// Solo servidor (Node): nunca importar desde componentes cliente.

import { rutaDataArchivo } from "@competitor-seeker/core";

/** Stream crudo de una corrida viva: `data/corridas-vivas/<id>.stream.jsonl`. */
export function rutaStream(corridaId: string): string {
  return rutaDataArchivo("corridas-vivas", `${corridaId}.stream.jsonl`);
}

/** Marcador que crea el runner al terminar el proceso. */
export function rutaFinStream(corridaId: string): string {
  return `${rutaStream(corridaId)}.fin`;
}

/** Id de corrida válido: solo lo que produce `nuevoIdCorrida` (sin rutas ni separadores). */
export function esIdCorridaValido(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(id) && !id.includes("..");
}
