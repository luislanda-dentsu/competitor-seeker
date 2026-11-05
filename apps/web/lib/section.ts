/** Sección visual de una ruta: decide el acento (degradado) de la vista. */
export type Seccion = "general" | "competidores" | "corridas" | "asistente";

export function seccionDe(pathname: string): Seccion {
  if (pathname.startsWith("/competidores")) return "competidores";
  if (pathname.startsWith("/corridas")) return "corridas";
  if (pathname.startsWith("/asistente")) return "asistente";
  return "general";
}
