import { describe, expect, it } from 'vitest'
import { conteoPorSenal, kpisMarca, semaforoPorCompetidor, seriePorCorrida } from '../src/kpis.ts'
import type { Corrida } from '../src/schemas/corrida.ts'
import type { Entrada } from '../src/schemas/entrada.ts'

function e(marca: string, fecha: string, senal: Entrada['senal'], corrida = 'c1'): Entrada {
  return { id: 'abcdef0123456789', corrida, marca, fecha, movimiento: 'm', senal, lectura: 'l' }
}
function c(id: string, fecha: string, estado: Corrida['estado'] = 'registrada', inicio = `${fecha}T10:00:00.000Z`): Corrida {
  return { id, marca: 'k', fecha, ultimaCorrida: null, inicio, estado, verificado: true, intentos: 1, objeciones: [], fuentes: [], competidores: [], entradas: [], modo: 'ui', maquina: 'h' }
}

describe('kpis', () => {
  it('semáforo: más reciente por fecha; empate → no-funciona > confuso > nuevo > sin-datos', () => {
    const s = semaforoPorCompetidor([
      e('A', '2026-08-01', 'no-funciona'),
      e('A', '2026-08-20', 'sin-datos'),
      e('A', '2026-08-20', 'nuevo'),
      e('A', '2026-08-20', 'confuso'),
      e('B', '2026-08-20', 'nuevo'),
      e('B', '2026-08-20', 'no-funciona'),
      e('B', '2026-08-19', 'confuso'),
    ])
    expect(s.get('A')?.senal).toBe('confuso')
    expect(s.get('B')?.senal).toBe('no-funciona')
  })

  it('conteoPorSenal', () => {
    expect(conteoPorSenal([e('A', '2026-08-01', 'nuevo'), e('A', '2026-08-01', 'nuevo'), e('B', '2026-08-01', 'sin-datos')]))
      .toEqual({ nuevo: 2, confuso: 0, 'sin-datos': 1, 'no-funciona': 0 })
  })

  it('kpisMarca y seriePorCorrida', () => {
    const corridas = [c('c2', '2026-09-01'), c('c1', '2026-08-01'), c('c3', '2026-09-15', 'pendiente-confirmacion')]
    const entradas = [
      e('A', '2026-08-01', 'nuevo', 'c1'), e('B', '2026-08-01', 'sin-datos', 'c1'),
      e('A', '2026-09-01', 'nuevo', 'c2'), e('A', '2026-09-01', 'nuevo', 'c2'), e('B', '2026-09-01', 'confuso', 'c2'),
    ]
    const k = kpisMarca({ entradas, corridas })
    expect(k.ultimaCorrida?.id).toBe('c2')
    expect(k.competidoresVigilados).toBe(2)
    expect(k.movimientosNuevosUltimaCorrida).toBe(2)
    expect(k.deltaVsAnterior).toBe(1)
    expect(k.pctConEvidencia).toBe(80)
    expect(kpisMarca({ entradas: [], corridas: [] })).toEqual({ competidoresVigilados: 0, movimientosNuevosUltimaCorrida: 0, deltaVsAnterior: null, pctConEvidencia: 0, ultimaCorrida: null })
    expect(seriePorCorrida(entradas, corridas)).toEqual([
      { corridaId: 'c1', fecha: '2026-08-01', nuevo: 1, confuso: 0, sinDatos: 1, noFunciona: 0 },
      { corridaId: 'c2', fecha: '2026-09-01', nuevo: 2, confuso: 1, sinDatos: 0, noFunciona: 0 },
    ])
  })
})
