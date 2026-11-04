import type { Cobertura, FormatoPost } from "@competitor-seeker/core";

export const ETIQUETA_FORMATO: Record<FormatoPost, string> = {
  reel: "Reel",
  carrusel: "Carrusel",
  imagen: "Imagen",
  video: "Video",
  otro: "Otro",
};

export const ETIQUETA_COBERTURA: Record<Cobertura, string> = {
  completa: "datos por post",
  parcial: "datos parciales",
  "sin-datos": "sin datos",
};

/** ER en %, con 2 decimales; "—" si no hay seguidores o cifras. */
export function fmtEr(er: number | null | undefined): string {
  if (er === null || er === undefined) return "—";
  return `${er.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}
