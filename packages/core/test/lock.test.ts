import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { adquirirLock, leerLock, liberarLock, LockOcupado, rutaLock } from '../src/lock.ts'
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

  it('reemplaza un lock corrupto', () => {
    fs.mkdirSync(rutaLock().replace(/corrida\.lock$/, ''), { recursive: true })
    fs.writeFileSync(rutaLock(), 'basura')
    expect(adquirirLock({ corridaId: 'n', marca: 'm' }).corridaId).toBe('n')
  })
})
