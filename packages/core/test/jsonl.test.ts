import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { appendJsonl, leerJsonl } from '../src/jsonl.ts'

const S = z.object({ a: z.number() })
let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-jsonl-')) })
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('jsonl', () => {
  it('archivo inexistente → items vacío', () => {
    expect(leerJsonl(path.join(dir, 'no.jsonl'), S)).toEqual({ items: [], lineasInvalidas: [] })
  })

  it('reporta líneas rotas sin lanzar e ignora líneas en blanco', () => {
    const ruta = path.join(dir, 'x.jsonl')
    fs.writeFileSync(ruta, '{"a":1}\n\n{rota\n{"a":"no"}\n{"a":2}\n')
    const r = leerJsonl(ruta, S)
    expect(r.items).toEqual([{ a: 1 }, { a: 2 }])
    expect(r.lineasInvalidas.map((l) => l.n)).toEqual([3, 4])
  })

  it('append crea carpeta, valida todo antes de escribir y repara el \\n final', () => {
    const ruta = path.join(dir, 'sub', 'y.jsonl')
    expect(appendJsonl(ruta, S, [{ a: 1 }])).toBe(1)
    expect(() => appendJsonl(ruta, S, [{ a: 2 }, { a: 'mal' }])).toThrow(/Item 1/)
    expect(fs.readFileSync(ruta, 'utf8')).toBe('{"a":1}\n')
    fs.writeFileSync(ruta, '{"a":1}') // sin salto final
    expect(appendJsonl(ruta, S, [{ a: 2 }])).toBe(1)
    expect(fs.readFileSync(ruta, 'utf8')).toBe('{"a":1}\n{"a":2}\n')
    expect(appendJsonl(ruta, S, [])).toBe(0)
  })
})
