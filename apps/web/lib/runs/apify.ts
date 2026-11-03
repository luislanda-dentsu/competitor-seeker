// Solo servidor (Node): nunca importar desde componentes cliente.

import {
  leerConfig,
  leerSecrets,
  obtenerUsoActual,
  USD_POR_RESULTADO,
  type ApifyPrompt,
  type Marca,
} from "@competitor-seeker/core";
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
 * Decide si Apify entra en esta corrida (equivale a `cs apify-uso`): delega en
 * `obtenerUsoActual` (caché de 10 min + corridas de todas las marcas).
 * Nunca lanza: cualquier fallo deja Apify fuera con motivo.
 */
export async function decidirApifyParaCorrida(incluir: boolean): Promise<ApifyPrompt> {
  const resultsLimit = leerConfig().apify.resultsLimitPorPerfil;
  if (!incluir) return { habilitado: false, resultsLimit, motivo: "desactivado por la usuaria" };
  try {
    const { decision } = await obtenerUsoActual();
    return { habilitado: decision.habilitado, resultsLimit: decision.resultsLimit, ...(decision.motivo ? { motivo: decision.motivo } : {}) };
  } catch (e) {
    return { habilitado: false, resultsLimit, motivo: `no se pudo consultar Apify: ${(e as Error).message}` };
  }
}
