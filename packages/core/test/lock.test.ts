import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { adquirirLock, esLockHuerfano, leerLock, liberarLock, LockOcupado, MAX_EDAD_LOCK_MS, rutaLock } from '../src/lock.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

let repo: RepoTemporal
beforeEach(() => { repo = crearRepoTemporal() })
afterEach(() => repo.limpiar())

describe('lock', () => {
  it('adquiere, bloquea a un segundo y libera', () => {
    const l = adquirirLock({ corridaId: 'c1', marca: 'm' })
    expect(l.pid).toBe(process.pid)
    expect(leerLock()?.corridaId).toBe('c1')
    expect(() => adquirirLock({ corridaId: 'c2', marca: 'm' })).toThrow(LockOcupado)
    try {
      adquirirLock({ corridaId: 'c2', marca: 'm' })
    } catch (e) {
      expect((e as LockOcupado).lock.corridaId).toBe('c1')
    }
    expect(liberarLock('c2')).toBe(false)
    expect(liberarLock('c1')).toBe(true)
    expect(leerLock()).toBeNull()
  })

  it('reemplaza un lock huérfano con pid inexistente', () => {
    fs.mkdirSync(rutaLock().replace(/corrida\.lock$/, ''), { recursive: true })
    fs.writeFileSync(rutaLock(), JSON.stringify({ pid: 2147483646, corridaId: 'vieja', marca: 'm', inicio: 'x', host: 'h' }))
    const l = adquirirLock({ corridaId: 'nueva', marca: 'm' })
    expect(l.corridaId).toBe('nueva')
    expect(leerLock()?.corridaId).toBe('nueva')
  })

  it('un lock con pid vivo pero más viejo de 6 h es huérfano (pid reutilizado)', () => {
    const ahora = new Date('2026-11-03T12:00:00.000Z')
    const viejo = new Date(ahora.getTime() - MAX_EDAD_LOCK_MS - 60_000).toISOString()
    const reciente = new Date(ahora.getTime() - MAX_EDAD_LOCK_MS + 60_000).toISOString()
    fs.mkdirSync(rutaLock().replace(/corrida\.lock$/, ''), { recursive: true })
    fs.writeFileSync(rutaLock(), JSON.stringify({ pid: process.pid, corridaId: 'vieja', marca: 'm', inicio: viejo, host: 'h' }))
    expect(esLockHuerfano(leerLock()!, ahora)).toBe(true)
    expect(adquirirLock({ corridaId: 'nueva', marca: 'm', ahora }).corridaId).toBe('nueva')
    expect(leerLock()?.corridaId).toBe('nueva')

    liberarLock()
    fs.writeFileSync(rutaLock(), JSON.stringify({ pid: process.pid, corridaId: 'activa', marca: 'm', inicio: reciente, host: 'h' }))
    expect(esLockHuerfano(leerLock()!, ahora)).toBe(false)
    expect(() => adquirirLock({ corridaId: 'otra', marca: 'm', ahora })).toThrow(LockOcupado)
    expect(leerLock()?.corridaId).toBe('activa')
  })

  it('reemplaza un lock corrupto', () => {
    fs.mkdirSync(rutaLock().replace(/corrida\.lock$/, ''), { recursive: true })
    fs.writeFileSync(rutaLock(), 'basura')
    expect(adquirirLock({ corridaId: 'n', marca: 'm' }).corridaId).toBe('n')
  })
})
