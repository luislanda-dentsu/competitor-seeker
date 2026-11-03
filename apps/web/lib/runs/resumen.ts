import type { Corrida } from "@competitor-seeker/core";
import type { ResumenFin } from "@/lib/runs/consola";

/** Resumen serializable de una corrida para el evento `fin` y la card de cierre. */
export function resumenDeCorrida(c: Corrida): ResumenFin {
  return {
    corridaId: c.id,
    marca: c.marca,
    estado: c.estado,
    verificado: c.verificado,
    intentos: c.intentos,
    entradas: c.entradas.length,
    objeciones: c.objeciones,
    ...(c.duracionMs !== undefined ? { duracionMs: c.duracionMs } : {}),
    ...(c.apify ? { apify: c.apify } : {}),
    ...(c.error ? { error: c.error } : {}),
    ...(c.ig ? { ig: c.ig } : {}),
  };
}
