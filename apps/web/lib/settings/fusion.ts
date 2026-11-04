// Mezcla de la config parcial recibida con la actual (deep-merge de `apify` y `apify.presupuesto`).
import type { ConfigCompartida } from "@competitor-seeker/core";

type Plano = Record<string, unknown>;

const esObjeto = (v: unknown): v is Plano => typeof v === "object" && v !== null && !Array.isArray(v);

/** `{ ...actual, ...parcial }` pero fusionando `apify` y `apify.presupuesto` en vez de reemplazarlos. */
export function fusionarConfig(actual: ConfigCompartida, parcial: Partial<ConfigCompartida>): unknown {
  const base = actual as unknown as Plano;
  const nuevo = parcial as unknown as Plano;
  const resultado: Plano = { ...base, ...nuevo };
  if (esObjeto(base.apify) && esObjeto(nuevo.apify)) {
    const apify: Plano = { ...base.apify, ...nuevo.apify };
    if (esObjeto(base.apify.presupuesto) && esObjeto(nuevo.apify.presupuesto)) {
      apify.presupuesto = { ...base.apify.presupuesto, ...nuevo.apify.presupuesto };
    }
    resultado.apify = apify;
  }
  return resultado;
}
