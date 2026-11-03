import { describe, expect, it } from 'vitest'
import { ApifyCorrida, ConfigCompartida, Corrida, Entrada, EntradaAgente, Marca, ResultadoWorkflow, Senal, SesionIg } from '../src/schemas/index.ts'

const base = { marca: 'X', fecha: '2026-08-20', movimiento: 'Hizo algo', senal: 'nuevo', lectura: 'Significa algo' }

describe('schemas', () => {
  it('EntradaAgente acepta los 5 campos y opcionales', () => {
    expect(EntradaAgente.parse(base)).toEqual(base)
    const conExtras = EntradaAgente.parse({ ...base, fuentes: ['ig'], metricas: { likes: 3 }, evidencia: ['https://x.com/p'] })
    expect(conExtras.fuentes).toEqual(['ig'])
    expect(conExtras.metricas?.likes).toBe(3)
  })

  it('evidencia admite referencias textuales, no solo URLs; rechaza cadenas vacías', () => {
    const textual = EntradaAgente.parse({ ...base, evidencia: ['post del 3/11 en el feed', 'https://x.com/p'] })
    expect(textual.evidencia).toEqual(['post del 3/11 en el feed', 'https://x.com/p'])
    expect(EntradaAgente.safeParse({ ...base, evidencia: [''] }).success).toBe(false)
    expect(EntradaAgente.safeParse({ ...base, evidencia: 'no-lista' }).success).toBe(false)
  })

  it('ApifyCorrida tolera motivo/runId null o ausentes; SesionIg incluye no-usado y error', () => {
    expect(ApifyCorrida.parse({ resultados: 0, costeEstimadoUsd: 0, motivo: null, runId: null })).toMatchObject({ motivo: null, runId: null })
    expect(ApifyCorrida.parse({})).toEqual({ resultados: 0, costeEstimadoUsd: 0 })
    expect(SesionIg.options).toEqual(['ok', 'no-disponible', 'no-usado', 'error', 'desconocido'])
    expect(ResultadoWorkflow.safeParse({ entradas: [], verificado: true, ig: { sesion: 'otra' } }).success).toBe(false)
  })

  it('rechaza señal fuera del enum y fecha no ISO', () => {
    expect(EntradaAgente.safeParse({ ...base, senal: 'bueno' }).success).toBe(false)
    expect(EntradaAgente.safeParse({ ...base, fecha: '20/08/2026' }).success).toBe(false)
    expect(Senal.options).toEqual(['nuevo', 'confuso', 'sin-datos', 'no-funciona'])
  })

  it('Entrada exige id de 16 hex y corrida', () => {
    expect(Entrada.safeParse({ ...base, corrida: 'c1' }).success).toBe(false)
    expect(Entrada.safeParse({ ...base, corrida: 'c1', id: 'abcdef0123456789' }).success).toBe(true)
  })

  it('Corrida valida estado y defaults', () => {
    const c = Corrida.parse({
      id: '2026-08-20-migrada', marca: 'kolareal', fecha: '2026-08-20', ultimaCorrida: null, inicio: '2026-08-20T00:00:00.000Z',
      estado: 'registrada', verificado: true, intentos: 0, modo: 'migrada', maquina: 'm',
    })
    expect(c.objeciones).toEqual([])
    expect(c.entradas).toEqual([])
    expect(Corrida.safeParse({ ...c, estado: 'rara' }).success).toBe(false)
  })

  it('Marca valida slug', () => {
    expect(Marca.safeParse({ slug: 'Kola Real', nombre: 'K', creadaEn: 'x' }).success).toBe(false)
    expect(Marca.parse({ slug: 'kola-real', nombre: 'K', creadaEn: 'x' }).competidores).toEqual([])
  })

  it('ConfigCompartida.parse({}) rellena todos los defaults', () => {
    const cfg = ConfigCompartida.parse({})
    expect(cfg.apify.resultsLimitPorPerfil).toBe(12)
    expect(cfg.apify.umbrales).toEqual([70, 90, 100])
    expect(cfg.apify.saltarSiPctMensual).toBe(90)
    expect(cfg.apify.presupuesto).toEqual({ mensualUsd: null, diarioUsd: null, semanalUsd: null })
    expect(cfg.sync).toEqual({ auto: true, rama: 'main' })
    expect(ConfigCompartida.parse({ apify: { habilitado: false } }).apify.resultsLimitPorPerfil).toBe(12)
  })
})
