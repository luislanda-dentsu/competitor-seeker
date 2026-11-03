// Consulta `GET /v2/users/me/limits` de Apify y la normaliza.
import { z } from 'zod'

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

export async function consultarLimites(token: string, fetchImpl: typeof fetch = fetch): Promise<LimitesApify> {
  const res = await fetchImpl(URL_LIMITES, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Apify respondió ${res.status} al consultar límites`)
  return parsearLimites(await res.json())
}
