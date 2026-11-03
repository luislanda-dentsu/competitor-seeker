// Solo servidor (Node): nunca importar desde componentes cliente.

import { esIdCorridaValido, rutaDataArchivo } from "@competitor-seeker/core";

export { esIdCorridaValido };

/** Slug de marca válido (`[a-z0-9]+(-[a-z0-9]+)*`), sin rutas ni separadores. */
export function esSlugMarcaValido(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;
}

/** Carpeta de streams de la marca: `data/corridas-vivas/<marca>/`. */
export function rutaStreamsMarca(marca: string): string {
  return rutaDataArchivo("corridas-vivas", marca);
}

/** Stream crudo de una corrida: `data/corridas-vivas/<marca>/<id>.stream.jsonl` (namespaceado por marca). */
export function rutaStream(marca: string, corridaId: string): string {
  return rutaDataArchivo("corridas-vivas", marca, `${corridaId}.stream.jsonl`);
}

/** Marcador que crea el runner al terminar el proceso. */
export function rutaFinStream(marca: string, corridaId: string): string {
  return `${rutaStream(marca, corridaId)}.fin`;
}
