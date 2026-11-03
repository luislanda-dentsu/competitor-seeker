// Solo servidor (Node): nunca importar desde componentes cliente.

import { decidirApifyDesdeEstado, leerConfig, leerSecrets, USD_POR_RESULTADO, type ApifyPrompt, type Marca } from "@competitor-seeker/core";
import type { ApifyUi } from "@/lib/runs/tipos";

/** Lo que el lanzador necesita para pintar el Switch y la estimación. */
export function apifyParaUi(): ApifyUi {
  const cfg = leerConfig().apify;
  let token: string | undefined;
  try {
    token = leerSecrets().apifyToken;
  } catch {
    token = undefined;
  }
  if (!token) return { disponible: false, motivo: "sin token", resultsLimit: cfg.resultsLimitPorPerfil, usdPorResultado: USD_POR_RESULTADO };
  if (!cfg.habilitado) return { disponible: false, motivo: "deshabilitado en config", resultsLimit: cfg.resultsLimitPorPerfil, usdPorResultado: USD_POR_RESULTADO };
  return { disponible: true, resultsLimit: cfg.resultsLimitPorPerfil, usdPorResultado: USD_POR_RESULTADO };
}

/** `resultsLimit × perfiles IG × $/resultado`, redondeado a centavos. */
export function estimarApifyUsd(marca: Marca, resultsLimit: number, usdPorResultado: number = USD_POR_RESULTADO): number {
  const perfiles = marca.competidores.filter((c) => c.activo && c.instagram).length;
  return Math.round(resultsLimit * perfiles * usdPorResultado * 100) / 100;
}

/**
 * Decide si Apify entra en esta corrida. Delega en `decidirApifyDesdeEstado`
 * (la misma decisión que `cs apify-uso`); nunca lanza.
 */
export async function decidirApifyParaCorrida(incluir: boolean): Promise<ApifyPrompt> {
  const d = await decidirApifyDesdeEstado({ incluir });
  return { habilitado: d.habilitado, resultsLimit: d.resultsLimit, ...(d.motivo ? { motivo: d.motivo } : {}) };
}
