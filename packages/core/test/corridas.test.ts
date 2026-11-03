import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esIdCorridaValido, guardarCorrida, hostCorto, listarCorridas, nuevoIdCorrida, ultimaCorridaRegistrada } from '../src/corridas.ts'
import { rutaCorridas } from '../src/rutas.ts'
import type { Corrida } from '../src/schemas/corrida.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

let repo: RepoTemporal
beforeEach(() => { repo = crearRepoTemporal() })
afterEach(() => repo.limpiar())

function c(id: string, fecha: string, estado: Corrida['estado'], inicio: string): Corrida {
  return { id, marca: 'k', fecha, ultimaCorrida: null, inicio, estado, verificado: true, intentos: 1, objeciones: [], fuentes: [], competidores: [], entradas: [], modo: 'ui', maquina: 'h' }
}

describe('corridas', () => {
  it('nuevoIdCorrida y hostCorto', () => {
    expect(hostCorto('Administrastors-MacBook-Air.local')).toBe('administrast')
    expect(hostCorto('MI.máquina')).toBe('mi')
    expect(nuevoIdCorrida('k', new Date(2026, 10, 3, 9, 5), 'mac')).toBe('2026-11-03-0905-k-mac')
    expect(nuevoIdCorrida('kolareal')).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}-kolareal-[a-z0-9-]{1,12}$/)
  })

  it('dos marcas en el mismo minuto reciben ids distintos', () => {
    const ahora = new Date(2026, 10, 3, 9, 5)
    const a = nuevoIdCorrida('kolareal', ahora, 'mac')
    const b = nuevoIdCorrida('zz-tmp', ahora, 'mac')
    expect(a).not.toBe(b)
    expect(a).toBe('2026-11-03-0905-kolareal-mac')
    expect(b).toBe('2026-11-03-0905-zz-tmp-mac')
    for (const id of [a, b, '2026-08-20-migrada', `${a}-2`]) expect(esIdCorridaValido(id)).toBe(true)
    for (const id of ['', '../x', 'a/b', '.oculto', 'con espacio', 'x'.repeat(130)]) expect(esIdCorridaValido(id)).toBe(false)
  })

  it('lista ordenada por inicio desc, reporta inválidas y calcula la última registrada', () => {
    expect(ultimaCorridaRegistrada('k')).toBeNull()
    guardarCorrida(c('a', '2026-08-01', 'registrada', '2026-08-01T10:00:00.000Z'))
    guardarCorrida(c('b', '2026-09-01', 'pendiente-confirmacion', '2026-09-01T10:00:00.000Z'))
    guardarCorrida(c('c', '2026-08-15', 'registrada', '2026-08-15T10:00:00.000Z'))
    fs.writeFileSync(path.join(rutaCorridas('k'), 'rota.json'), '{"id":"x"}')
    const l = listarCorridas('k')
    expect(l.corridas.map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(l.invalidas.map((i) => i.archivo)).toEqual(['rota.json'])
    expect(ultimaCorridaRegistrada('k')).toBe('2026-08-15')
    expect(fs.readFileSync(path.join(rutaCorridas('k'), 'a.json'), 'utf8')).toMatch(/^\{\n  "id": "a"/)
  })
})
