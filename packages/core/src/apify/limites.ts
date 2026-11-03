// Consulta `GET /v2/users/me/limits` de Apify y la normaliza; decide si la
// próxima corrida incluye Apify a partir del estado real (config, token, uso).
import { z } from 'zod'
import { leerConfig, leerSecrets } from '../config.ts'
import { listarCorridas } from '../corridas.ts'
import { listarMarcas } from '../marcas.ts'
import { calcularUso, decidirApify, type UsoApify } from './uso.ts'

export const LimitesApify = z.object({
  ciclo: z.object({ inicio: z.string(), fin: z.string() }),
  mensual: z.object({ usadoUsd: z.number().nonnegative(), limiteUsd: z.number().nonnegative() }),
})
export type LimitesApify = z.infer<typeof LimitesApify>

/** Forma (parcial) de la respuesta de la API. */
const RespuestaLimites = z.object({
  data: z.object({
    monthlyUsageCycle: z.object({ startAt: z.string(), endAt: z.string() }),
    limits: z.object({ maxMonthlyUsageUsd: z.number().nonnegative() }).loose(),
    current: z.object({ monthlyUsageUsd: z.number().nonnegative() }).loose(),
  }).loose(),
})

export function parsearLimites(json: unknown): LimitesApify {
  const r = RespuestaLimites.parse(json)
  return {
    ciclo: { inicio: r.data.monthlyUsageCycle.startAt, fin: r.data.monthlyUsageCycle.endAt },
    mensual: { usadoUsd: r.data.current.monthlyUsageUsd, limiteUsd: r.data.limits.maxMonthlyUsageUsd },
  }
}

export const URL_LIMITES = 'https://api.apify.com/v2/users/me/limits'

export const TIMEOUT_LIMITES_MS = 10_000

export async function consultarLimites(
  token: string,
  fetchImpl: typeof fetch = fetch,
  signal: AbortSignal = AbortSignal.timeout(TIMEOUT_LIMITES_MS),
): Promise<LimitesApify> {
  const res = await fetchImpl(URL_LIMITES, { headers: { Authorization: `Bearer ${token}` }, signal })
  if (!res.ok) throw new Error(`Apify respondió ${res.status} al consultar límites`)
  return parsearLimites(await res.json())
}

export interface OpcionesDecision {
  /** `false`: la persona desactivó Apify para esta corrida (no se consulta nada). */
  incluir?: boolean
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export interface DecisionApifyEstado {
  /** Hay token (archivo o `APIFY_TOKEN`). */
  configurado: boolean
  habilitado: boolean
  resultsLimit: number
  motivo?: string
  /** Uso real cuando se pudo consultar la API. */
  uso?: UsoApify
}

/**
 * Única fuente de la decisión de Apify (la usan `cs apify-uso` y la UI al
 * lanzar): config → token → límites reales (con timeout) → presupuestos.
 * Nunca lanza: cualquier fallo deja Apify fuera con motivo.
 */
export async function decidirApifyDesdeEstado(o: OpcionesDecision = {}): Promise<DecisionApifyEstado> {
  let resultsLimit = 12
  try {
    const cfg = leerConfig().apify
    resultsLimit = cfg.resultsLimitPorPerfil
    if (o.incluir === false) return { configurado: true, habilitado: false, resultsLimit, motivo: 'desactivado por la usuaria' }
    const token = leerSecrets().apifyToken
    if (!token) return { configurado: false, habilitado: false, resultsLimit, motivo: 'sin token' }
    if (!cfg.habilitado) return { configurado: true, habilitado: false, resultsLimit, motivo: 'deshabilitado en config' }
    const limites = await consultarLimites(token, o.fetchImpl, AbortSignal.timeout(o.timeoutMs ?? TIMEOUT_LIMITES_MS))
    const corridas = listarMarcas().flatMap((m) => listarCorridas(m.slug).corridas)
    const uso = calcularUso(limites, cfg, corridas)
    const decision = decidirApify(uso, cfg)
    return { configurado: true, habilitado: decision.habilitado, resultsLimit: decision.resultsLimit, ...(decision.motivo ? { motivo: decision.motivo } : {}), uso }
  } catch (e) {
    const detalle = (e as Error).name === 'TimeoutError' ? 'tiempo de espera agotado' : (e as Error).message
    return { configurado: true, habilitado: false, resultsLimit, motivo: `no se pudo consultar Apify: ${detalle}` }
  }
}
