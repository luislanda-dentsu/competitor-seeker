import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  agruparPorFecha,
  borrarChat,
  esIdChatValido,
  grupoDeFecha,
  guardarChat,
  leerChat,
  listarChats,
  nuevoChat,
  rutaChats,
  tituloDeMensaje,
} from '../src/chats.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

let repo: RepoTemporal
beforeEach(() => { repo = crearRepoTemporal() })
afterEach(() => repo.limpiar())

describe('chats', () => {
  it('tituloDeMensaje toma las primeras 6 palabras', () => {
    expect(tituloDeMensaje('Resume la última corrida')).toBe('Resume la última corrida')
    expect(tituloDeMensaje('¿Qué hizo Coca Cola RD en agosto y qué no pudimos verificar?')).toBe('¿Qué hizo Coca Cola RD en…')
    expect(tituloDeMensaje('  # hola\n\nmundo  ')).toBe('hola mundo')
    expect(tituloDeMensaje('   ')).toBe('Nuevo chat')
    expect(tituloDeMensaje('a'.repeat(120)).length).toBeLessThanOrEqual(80)
  })

  it('nuevoChat crea id uuid, título y primer mensaje sin escribir en disco', () => {
    const ahora = new Date('2026-11-03T10:00:00.000Z')
    const chat = nuevoChat('kolareal', 'Resume la última corrida', { ahora })
    expect(esIdChatValido(chat.id)).toBe(true)
    expect(chat.titulo).toBe('Resume la última corrida')
    expect(chat.creado).toBe('2026-11-03T10:00:00.000Z')
    expect(chat.mensajes).toEqual([{ rol: 'usuario', texto: 'Resume la última corrida', ts: '2026-11-03T10:00:00.000Z' }])
    expect(chat.sessionId).toBeUndefined()
    expect(fs.existsSync(rutaChats('kolareal'))).toBe(false)
  })

  it('guardar / leer / listar / borrar', () => {
    const a = nuevoChat('kolareal', 'Primero', { ahora: new Date('2026-11-01T10:00:00.000Z') })
    const b = nuevoChat('kolareal', 'Segundo', { ahora: new Date('2026-11-02T10:00:00.000Z') })
    guardarChat(a)
    guardarChat({ ...b, sessionId: 'sess-1', mensajes: [...b.mensajes, { rol: 'asistente', texto: 'Hola', ts: b.creado, artefacto: { titulo: 'T', ids: ['abc'] } }] })
    guardarChat(nuevoChat('otra', 'De otra marca'))
    fs.writeFileSync(path.join(rutaChats('kolareal'), 'roto.json'), '{')

    expect(leerChat('kolareal', a.id)?.titulo).toBe('Primero')
    expect(leerChat('kolareal', b.id)?.sessionId).toBe('sess-1')
    expect(leerChat('kolareal', b.id)?.mensajes[1]?.artefacto?.ids).toEqual(['abc'])
    expect(leerChat('kolareal', '00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(() => leerChat('kolareal', '../x')).toThrow(/inválido/)

    const lista = listarChats('kolareal')
    expect(lista.map((c) => c.id)).toEqual([b.id, a.id])
    expect(lista[0]).toMatchObject({ titulo: 'Segundo', mensajes: 2 })
    expect(listarChats('inexistente')).toEqual([])

    expect(borrarChat('kolareal', a.id)).toBe(true)
    expect(borrarChat('kolareal', a.id)).toBe(false)
    expect(listarChats('kolareal').map((c) => c.id)).toEqual([b.id])
    expect(fs.readFileSync(path.join(rutaChats('kolareal'), `${b.id}.json`), 'utf8')).toMatch(/^\{\n  "id"/)
  })

  it('guardarChat valida el schema', () => {
    const chat = nuevoChat('kolareal', 'x')
    expect(() => guardarChat({ ...chat, mensajes: [{ rol: 'otro' as 'usuario', texto: '', ts: 'x' }] })).toThrow()
  })

  it('agruparPorFecha: Hoy / Ayer / Últimos 7 días / Anteriores', () => {
    const ahora = new Date(2026, 10, 3, 15, 30) // 3 nov 2026 15:30 local
    const iso = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()
    expect(grupoDeFecha(iso(2026, 11, 3, 0), ahora)).toBe('Hoy')
    expect(grupoDeFecha(iso(2026, 11, 2, 23), ahora)).toBe('Ayer')
    expect(grupoDeFecha(iso(2026, 10, 28), ahora)).toBe('Últimos 7 días')
    expect(grupoDeFecha(iso(2026, 10, 26), ahora)).toBe('Anteriores')
    expect(grupoDeFecha('no-es-fecha', ahora)).toBe('Anteriores')

    const chats = [
      { id: 'h', actualizado: iso(2026, 11, 3, 9) },
      { id: 'a', actualizado: iso(2026, 11, 2) },
      { id: 's', actualizado: iso(2026, 10, 30) },
      { id: 'v', actualizado: iso(2026, 9, 1) },
      { id: 'h2', actualizado: iso(2026, 11, 3, 8) },
    ]
    const grupos = agruparPorFecha(chats, ahora)
    expect(grupos.map((g) => g.grupo)).toEqual(['Hoy', 'Ayer', 'Últimos 7 días', 'Anteriores'])
    expect(grupos[0]!.chats.map((c) => c.id)).toEqual(['h', 'h2'])
    expect(agruparPorFecha([{ actualizado: iso(2026, 11, 3) }], ahora).map((g) => g.grupo)).toEqual(['Hoy'])
    expect(agruparPorFecha([], ahora)).toEqual([])
  })
})
