import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { leerCorrida, ultimaCorridaRegistrada } from '../src/corridas.ts'
import { leerLog } from '../src/log.ts'
import { leerMarca } from '../src/marcas.ts'
import { fechaCorridaDesdeIndex, migrarMarca } from '../src/migracion.ts'
import { rutaMarca } from '../src/rutas.ts'
import { crearRepoTemporal, leerFixture, type RepoTemporal } from './helpers.ts'

let repo: RepoTemporal
function sembrar(slug = 'kolareal', conIndex = true): string {
  const carpeta = rutaMarca(slug)
  fs.mkdirSync(carpeta, { recursive: true })
  fs.writeFileSync(path.join(carpeta, 'log.json'), leerFixture('kolareal.log.json'))
  fs.writeFileSync(path.join(carpeta, 'competidores.txt'), leerFixture('kolareal.competidores.txt'))
  if (conIndex) fs.writeFileSync(path.join(carpeta, 'index.html'), leerFixture('kolareal.index.html'))
  return carpeta
}
beforeEach(() => { repo = crearRepoTemporal() })
afterEach(() => repo.limpiar())

describe('migracion', () => {
  it('migra las 16 entradas, crea marca.json y la corrida sintética', () => {
    const carpeta = sembrar()
    const r = migrarMarca('kolareal')
    expect(r).toEqual({ entradas: 16, competidores: 2, corridaId: '2026-08-20-migrada', yaMigrada: false })
    expect(fs.readFileSync(path.join(carpeta, 'log.jsonl'), 'utf8').split('\n').filter(Boolean).length).toBe(16)
    const log = leerLog('kolareal')
    expect(log.lineasInvalidas).toEqual([])
    expect(new Set(log.items.map((e) => e.id)).size).toBe(16)
    expect(log.items.every((e) => e.corrida === '2026-08-20-migrada')).toBe(true)
    const marca = leerMarca('kolareal')
    expect(marca.nombre).toBe('Kolareal')
    expect(marca.competidores.map((c) => c.instagram)).toEqual(['cocacolard', 'countryclubrd'])
    const corrida = leerCorrida('kolareal', '2026-08-20-migrada')
    expect(corrida.estado).toBe('registrada')
    expect(corrida.modo).toBe('migrada')
    expect(corrida.maquina).toBe('migracion')
    expect(corrida.fuentes).toEqual(['web', 'ig'])
    expect(corrida.competidores).toEqual(['Coca Cola RD', 'Country Club RD'])
    expect(corrida.entradas.length).toBe(16)
    expect(ultimaCorridaRegistrada('kolareal')).toBe('2026-08-20')
    expect(fs.existsSync(path.join(carpeta, 'log.json'))).toBe(false)
    expect(fs.existsSync(path.join(carpeta, 'log.json.migrado'))).toBe(true)
    expect(fs.existsSync(path.join(carpeta, 'index.html'))).toBe(false)
    expect(fs.existsSync(path.join(carpeta, 'competidores.txt'))).toBe(false)
  })

  it('segunda ejecución → yaMigrada sin cambios; ids estables', () => {
    const carpeta = sembrar()
    migrarMarca('kolareal')
    const antes = fs.readFileSync(path.join(carpeta, 'log.jsonl'), 'utf8')
    const r2 = migrarMarca('kolareal')
    expect(r2).toEqual({ entradas: 16, competidores: 2, corridaId: '2026-08-20-migrada', yaMigrada: true })
    expect(fs.readFileSync(path.join(carpeta, 'log.jsonl'), 'utf8')).toBe(antes)

    // Ids estables entre dos migraciones independientes.
    repo.limpiar()
    repo = crearRepoTemporal()
    sembrar()
    migrarMarca('kolareal')
    expect(fs.readFileSync(path.join(rutaMarca('kolareal'), 'log.jsonl'), 'utf8')).toBe(antes)
  })

  it('sin index.html usa la mayor fecha del log', () => {
    sembrar('otra', false)
    expect(migrarMarca('otra').corridaId).toBe('2026-08-20-migrada')
  })

  it('fechaCorridaDesdeIndex ignora bloques demo', () => {
    expect(fechaCorridaDesdeIndex(leerFixture('kolareal.index.html'))).toBe('2026-08-20')
    expect(fechaCorridaDesdeIndex('<script type="application/json" id="datos">{"demo":true,"corrida":"2026-01-01"}</script>')).toBeNull()
  })

  it('sin nada que migrar lanza', () => {
    expect(() => migrarMarca('nadie')).toThrow(/Nada que migrar/)
  })
})
