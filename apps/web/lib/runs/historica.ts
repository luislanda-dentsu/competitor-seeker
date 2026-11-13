// Solo servidor (Node): nunca importar desde componentes cliente.

import {
  competidoresActivos,
  estimarCorridaHistorica,
  fechaLocal,
  leerMarca,
  listarCorridas,
  obtenerUsoActual,
  USD_POR_RESULTADO,
  validarVentana,
  type EstimacionHistorica,
} from "@competitor-seeker/core";

export interface EstimacionConPresupuesto extends EstimacionHistorica {
  /** Lo que queda del presupuesto mensual de Apify (null si no se pudo consultar). */
  restanteMensualUsd: number | null;
  /** El tope se bajó para no pasar del presupuesto mensual restante. */
  limitadoPorPresupuesto: boolean;
}

export type ResultadoEstimacion = { ok: true; estimacion: EstimacionConPresupuesto } | { ok: false; error: string };

function redondearUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Valida la ventana y estima posts y coste de Apify para los competidores con Instagram de la marca.
 * El tope nunca supera lo que queda del presupuesto mensual (la corrida histórica la confirma la
 * usuaria, así que los presupuestos derivados diario/semanal no la bloquean).
 */
export async function estimarHistorica(slug: string, ventana: { desde?: unknown; hasta?: unknown }): Promise<ResultadoEstimacion> {
  const error = validarVentana(ventana, fechaLocal(new Date()));
  if (error) return { ok: false, error };
  const v = { desde: ventana.desde as string, hasta: ventana.hasta as string };
  const conIg = competidoresActivos(leerMarca(slug))
    .filter((c) => c.instagram)
    .map((c) => c.nombre);
  const base = estimarCorridaHistorica(listarCorridas(slug).corridas, conIg, v);

  let restante: number | null = null;
  try {
    const { uso } = await obtenerUsoActual();
    if (uso) restante = Math.max(0, uso.mensual.limiteUsd - uso.mensual.usadoUsd);
  } catch {
    restante = null;
  }
  if (restante === null || base.costeMaximoUsd <= restante) {
    return { ok: true, estimacion: { ...base, restanteMensualUsd: restante === null ? null : redondearUsd(restante), limitadoPorPresupuesto: false } };
  }
  const topePosts = Math.floor(restante / USD_POR_RESULTADO);
  return {
    ok: true,
    estimacion: {
      ...base,
      topePosts,
      costeMaximoUsd: redondearUsd(topePosts * USD_POR_RESULTADO),
      costeEstimadoUsd: Math.min(base.costeEstimadoUsd, redondearUsd(topePosts * USD_POR_RESULTADO)),
      restanteMensualUsd: redondearUsd(restante),
      limitadoPorPresupuesto: true,
    },
  };
}
