import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { entradasPorCompetidor, idEntrada, leerLog, registrarEntradas } from '../src/log.ts'
import { rutaLog } from '../src/rutas.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

const e1 = { marca: 'A', fecha: '2026-08-20', movimiento: 'm1', senal: 'nuevo', lectura: 'l' } as const
const e2 = { marca: 'B', fecha: '2026-08-20', movimiento: 'm2', senal: 'sin-datos', lectura: 'l' } as const

let repo: RepoTemporal
beforeEach(() => { repo = crearRepoTemporal() })
afterEach(() => repo.limpiar())

describe('log', () => {
  it('idEntrada es determinista y de 16 hex', () => {
    expect(idEntrada(e1)).toMatch(/^[0-9a-f]{16}$/)
    const otraLectura = { ...e1, lectura: 'otra' }
    expect(idEntrada(e1)).toBe(idEntrada(otraLectura))
    expect(idEntrada(e1)).not.toBe(idEntrada(e2))
  })

  it('registra, descarta duplicados y nunca reduce líneas', () => {
    const r1 = registrarEntradas('m', 'c1', [e1, e2])
    expect(r1.registradas).toBe(2)
    expect(r1.entradas[0]?.corrida).toBe('c1')
    const lineas1 = fs.readFileSync(rutaLog('m'), 'utf8').split('\n').filter(Boolean).length
    const r2 = registrarEntradas('m', 'c2', [e1, { ...e2, movimiento: 'm3' }, e1])
    expect(r2.registradas).toBe(1)
    expect(r2.duplicadas).toEqual([idEntrada(e1), idEntrada(e1)])
    const lineas2 = fs.readFileSync(rutaLog('m'), 'utf8').split('\n').filter(Boolean).length
    expect(lineas2).toBeGreaterThanOrEqual(lineas1)
    expect(lineas2).toBe(3)
    const log = leerLog('m')
    expect(log.items.map((e) => e.corrida)).toEqual(['c1', 'c1', 'c2'])
    expect(log.lineasInvalidas).toEqual([])
  })

  it('una entrada inválida aborta sin escribir nada', () => {
    expect(() => registrarEntradas('m', 'c1', [e1, { ...e2, senal: 'x' } as never])).toThrow()
    expect(fs.existsSync(rutaLog('m'))).toBe(false)
  })

  it('entradasPorCompetidor agrupa conservando orden', () => {
    const g = entradasPorCompetidor([e1, e2, { ...e1, movimiento: 'z' }])
    expect([...g.keys()]).toEqual(['A', 'B'])
    expect(g.get('A')?.length).toBe(2)
  })
})
