// Solo servidor (Node): nunca importar desde componentes cliente.

import {
  competidoresActivos,
  estimarCorridaHistorica,
  fechaLocal,
  leerMarca,
  listarCorridas,
  validarVentana,
  type EstimacionHistorica,
} from "@competitor-seeker/core";

export type ResultadoEstimacion = { ok: true; estimacion: EstimacionHistorica } | { ok: false; error: string };

/** Valida la ventana y estima posts y coste de Apify para los competidores con Instagram de la marca. */
export function estimarHistorica(slug: string, ventana: { desde?: unknown; hasta?: unknown }): ResultadoEstimacion {
  const error = validarVentana(ventana, fechaLocal(new Date()));
  if (error) return { ok: false, error };
  const v = { desde: ventana.desde as string, hasta: ventana.hasta as string };
  const conIg = competidoresActivos(leerMarca(slug))
    .filter((c) => c.instagram)
    .map((c) => c.nombre);
  return { ok: true, estimacion: estimarCorridaHistorica(listarCorridas(slug).corridas, conIg, v) };
}
