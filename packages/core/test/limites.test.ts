import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decidirApifyDesdeEstado } from '../src/apify/limites.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

let repo: RepoTemporal
const tokenPrevio = process.env.APIFY_TOKEN
beforeEach(() => {
  process.env.APIFY_TOKEN = 'apify_test_token'
  repo = crearRepoTemporal()
})
afterEach(() => {
  repo.limpiar()
  if (tokenPrevio === undefined) delete process.env.APIFY_TOKEN
  else process.env.APIFY_TOKEN = tokenPrevio
})

/** fetch que nunca responde pero respeta `signal` (como haría la red colgada). */
const fetchColgado: typeof fetch = (_url, init) =>
  new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))

const fetchOk: typeof fetch = async () =>
  new Response(JSON.stringify({ data: { monthlyUsageCycle: { startAt: '2026-11-01T00:00:00.000Z', endAt: '2026-12-01T00:00:00.000Z' }, limits: { maxMonthlyUsageUsd: 100 }, current: { monthlyUsageUsd: 5 } } }), { status: 200 })

describe('decidirApifyDesdeEstado', () => {
  it('desactivado por la usuaria: no consulta nada', async () => {
    const d = await decidirApifyDesdeEstado({ incluir: false, fetchImpl: fetchColgado, timeoutMs: 50 })
    expect(d).toMatchObject({ habilitado: false, motivo: 'desactivado por la usuaria', resultsLimit: 12 })
  })

  it('con la API colgada corta por timeout y deja Apify fuera con motivo (nunca lanza)', async () => {
    const d = await decidirApifyDesdeEstado({ fetchImpl: fetchColgado, timeoutMs: 50 })
    expect(d.habilitado).toBe(false)
    expect(d.motivo).toBe('no se pudo consultar Apify: tiempo de espera agotado')
  })

  it('con límites reales decide habilitar y devuelve el uso', async () => {
    const d = await decidirApifyDesdeEstado({ fetchImpl: fetchOk })
    expect(d.habilitado).toBe(true)
    expect(d.configurado).toBe(true)
    expect(d.uso?.mensual).toEqual({ usadoUsd: 5, limiteUsd: 100, pct: 5 })
  })

  it('sin token: configurado false y motivo "sin token"', async () => {
    delete process.env.APIFY_TOKEN
    repo.limpiar()
    repo = crearRepoTemporal()
    const d = await decidirApifyDesdeEstado({ fetchImpl: fetchOk })
    expect(d).toMatchObject({ configurado: false, habilitado: false, motivo: 'sin token' })
  })
})
