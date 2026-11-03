import { describe, expect, it } from 'vitest'
import { estimarCosteUsd } from '../src/apify/coste.ts'
import { parsearLimites } from '../src/apify/limites.ts'
import { calcularUso, decidirApify, umbralAlcanzado } from '../src/apify/uso.ts'
import { ConfigApify } from '../src/schemas/config.ts'
import type { Corrida } from '../src/schemas/corrida.ts'

const cfg = ConfigApify.parse({})
const limites = (usado: number, limite = 100) => ({
  ciclo: { inicio: '2026-11-01T00:00:00.000Z', fin: '2026-12-01T00:00:00.000Z' },
  mensual: { usadoUsd: usado, limiteUsd: limite },
})
const ahora = new Date(2026, 10, 3, 12, 0, 0) // 3-nov-2026 mediodía local

function corrida(inicio: Date, coste: number): Corrida {
  return {
    id: `c-${inicio.getTime()}`, marca: 'm', fecha: '2026-11-03', ultimaCorrida: null, inicio: inicio.toISOString(),
    estado: 'registrada', verificado: true, intentos: 1, objeciones: [], fuentes: ['apify'],
    apify: { resultados: Math.round(coste / 0.0027), costeEstimadoUsd: coste }, competidores: [], entradas: [], modo: 'ui', maquina: 'h',
  }
}

describe('apify-uso', () => {
  it('umbrales 69/70/90/100', () => {
    const u = cfg.umbrales
    expect(umbralAlcanzado(69, u)).toBeNull()
    expect(umbralAlcanzado(70, u)).toBe(70)
    expect(umbralAlcanzado(89.9, u)).toBe(70)
    expect(umbralAlcanzado(90, u)).toBe(90)
    expect(umbralAlcanzado(100, u)).toBe(100)
    expect(umbralAlcanzado(130, u)).toBe(100)
  })

  it('decidirApify corta en saltarSiPctMensual (90) y respeta config', () => {
    expect(decidirApify(calcularUso(limites(69), cfg, [], ahora), cfg)).toEqual({ habilitado: true, resultsLimit: 12 })
    expect(decidirApify(calcularUso(limites(70), cfg, [], ahora), cfg).habilitado).toBe(true)
    expect(decidirApify(calcularUso(limites(89.9), cfg, [], ahora), cfg).habilitado).toBe(true)
    const d90 = decidirApify(calcularUso(limites(90), cfg, [], ahora), cfg)
    expect(d90.habilitado).toBe(false)
    expect(d90.motivo).toMatch(/mensual 90%/)
    expect(decidirApify(calcularUso(limites(100), cfg, [], ahora), cfg).habilitado).toBe(false)
    expect(decidirApify(calcularUso(limites(0), cfg, [], ahora), { ...cfg, habilitado: false }).motivo).toBe('deshabilitado en config')
  })

  it('ventanas diaria y semanal suman el coste de las corridas en ventana', () => {
    const corridas = [
      corrida(new Date(2026, 10, 3, 9), 1.0), // hoy
      corrida(new Date(2026, 10, 2, 9), 2.0), // ayer (semana, no día)
      corrida(new Date(2026, 9, 25, 9), 5.0), // hace 9 días (fuera)
    ]
    const uso = calcularUso(limites(30), cfg, corridas, ahora)
    expect(uso.mensual).toEqual({ usadoUsd: 30, limiteUsd: 100, pct: 30 })
    expect(uso.diario.usadoUsd).toBe(1)
    expect(uso.diario.limiteUsd).toBeCloseTo(100 / 30, 2)
    expect(uso.semanal.usadoUsd).toBe(3)
    expect(uso.semanal.limiteUsd).toBeCloseTo(700 / 30, 2)
    expect(decidirApify(uso, cfg).habilitado).toBe(true)
  })

  it('presupuestos explícitos: diario agotado deshabilita, semanal también', () => {
    const cfgDia = { ...cfg, presupuesto: { mensualUsd: 50, diarioUsd: 1, semanalUsd: null } }
    const uso = calcularUso(limites(30), cfgDia, [corrida(new Date(2026, 10, 3, 9), 1.0)], ahora)
    expect(uso.mensual.limiteUsd).toBe(50)
    expect(uso.diario.pct).toBe(100)
    expect(uso.semanal.limiteUsd).toBe(7)
    expect(decidirApify(uso, cfgDia).motivo).toMatch(/diario/)
    const cfgSem = { ...cfg, presupuesto: { mensualUsd: null, diarioUsd: null, semanalUsd: 2 } }
    const uso2 = calcularUso(limites(30), cfgSem, [corrida(new Date(2026, 10, 1, 9), 2.0)], ahora)
    expect(uso2.semanal.pct).toBe(100)
    expect(decidirApify(uso2, cfgSem).motivo).toMatch(/semanal/)
  })

  it('parsearLimites y estimarCosteUsd', () => {
    const l = parsearLimites({
      data: {
        monthlyUsageCycle: { startAt: '2026-11-01T00:00:00.000Z', endAt: '2026-12-01T00:00:00.000Z' },
        limits: { maxMonthlyUsageUsd: 5, otro: 1 },
        current: { monthlyUsageUsd: 1.25 },
      },
    })
    expect(l.mensual).toEqual({ usadoUsd: 1.25, limiteUsd: 5 })
    expect(estimarCosteUsd(12)).toBeCloseTo(0.0324, 4)
    expect(estimarCosteUsd(0)).toBe(0)
  })
})
