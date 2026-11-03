// Tarjetas de sugerencia del estado inicial del asistente, derivadas de los
// datos de la marca. Puro (se testea): el servidor lo llama con el log.
import type { Sugerencia } from "@/lib/chat/tipos";

export interface EntradaMinima {
  marca: string;
  senal: string;
  fecha: string;
}

const MAX = 3;

/** Competidor con más entradas `no-funciona` (empate: la más reciente). */
function competidorNoFunciona(entradas: readonly EntradaMinima[]): { nombre: string; n: number } | null {
  const conteo = new Map<string, { n: number; fecha: string }>();
  for (const e of entradas) {
    if (e.senal !== "no-funciona") continue;
    const actual = conteo.get(e.marca) ?? { n: 0, fecha: "" };
    conteo.set(e.marca, { n: actual.n + 1, fecha: e.fecha > actual.fecha ? e.fecha : actual.fecha });
  }
  let mejor: { nombre: string; n: number; fecha: string } | null = null;
  for (const [nombre, v] of conteo) {
    if (!mejor || v.n > mejor.n || (v.n === mejor.n && v.fecha > mejor.fecha)) mejor = { nombre, ...v };
  }
  return mejor ? { nombre: mejor.nombre, n: mejor.n } : null;
}

/**
 * Siempre "Resume la última corrida"; si hay `no-funciona`, pregunta por el
 * competidor más afectado; si hay `sin-datos`, pide la lista de lo no
 * verificado. Se completa hasta 3 con preguntas fijas.
 */
export function sugerenciasDe(entradas: readonly EntradaMinima[]): Sugerencia[] {
  const salida: Sugerencia[] = [{ id: "resumen", texto: "Resume la última corrida" }];
  const nf = competidorNoFunciona(entradas);
  if (nf) {
    salida.push({
      id: "no-funciona",
      texto: `¿Por qué no funciona el contenido de ${nf.nombre}?`,
      motivo: `${nf.n} ${nf.n === 1 ? "entrada" : "entradas"} no-funciona`,
    });
  }
  const sinDatos = entradas.filter((e) => e.senal === "sin-datos").length;
  if (sinDatos > 0) {
    salida.push({
      id: "sin-datos",
      texto: "Lista lo que no pudimos verificar y qué haría falta",
      motivo: `${sinDatos} ${sinDatos === 1 ? "entrada" : "entradas"} sin-datos`,
    });
  }
  const fijas: Sugerencia[] = [
    { id: "comparar", texto: "Compara la actividad de los competidores este mes" },
    { id: "senales", texto: "¿Qué significa cada señal y cuántas hay de cada una?" },
  ];
  for (const f of fijas) if (salida.length < MAX) salida.push(f);
  return salida.slice(0, MAX);
}
