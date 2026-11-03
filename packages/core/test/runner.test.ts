import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { argsClaude, lanzarClaude, MOCK_STREAM } from '../src/claude/runner.ts'
import type { EventoStream } from '../src/claude/stream-json.ts'
import { resumirEventos } from '../src/claude/stream-json.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

let repo: RepoTemporal
beforeEach(() => { repo = crearRepoTemporal() })
afterEach(() => repo.limpiar())

async function recoger(it: AsyncIterable<EventoStream>): Promise<EventoStream[]> {
  const out: EventoStream[] = []
  for await (const ev of it) out.push(ev)
  return out
}

describe('runner (mock)', () => {
  it('argsClaude incluye los flags headless y las tools permitidas', () => {
    const args = argsClaude({ prompt: 'hola', allowedTools: ['Read', 'Bash(scripts/cs *)'], name: 'c1', jsonSchema: { type: 'object' } })
    expect(args.slice(0, 2)).toEqual(['-p', 'hola'])
    expect(args).toContain('--permission-mode')
    expect(args).toContain('dontAsk')
    expect(args).toContain('--chrome')
    const i = args.indexOf('--allowedTools')
    expect(args.slice(i + 1, i + 3)).toEqual(['Read', 'Bash(scripts/cs *)'])
    expect(args).toContain('--name')
    expect(args[args.indexOf('--json-schema') + 1]).toBe('{"type":"object"}')
    expect(() => argsClaude({ prompt: 'x', sessionId: 'a', resume: 'b' })).toThrow()
  })

  it('reproduce el stream grabado, vuelca cada línea y crea el marcador .fin', async () => {
    const volcado = path.join(repo.raiz, 'data', 'vivas', 'c1.stream.jsonl')
    const p = lanzarClaude({ prompt: 'x', runner: 'mock', mockDelayMs: 1, volcarA: volcado })
    expect(p.proceso).toBeNull()
    const eventos = await recoger(p.eventos)
    const salida = await p.salida
    const grabadas = fs.readFileSync(MOCK_STREAM, 'utf8').split('\n').filter((l) => l.trim() !== '').length
    expect(eventos.length).toBe(grabadas)
    expect(salida.code).toBe(0)
    expect(salida.sessionId).toBe('9bb59c5d-b02a-4bb8-b2fe-631fef7e3b66')
    expect(fs.readFileSync(volcado, 'utf8').split('\n').filter((l) => l !== '').length).toBe(grabadas)
    expect(fs.existsSync(`${volcado}.fin`)).toBe(true)

    const resumidos = eventos.flatMap((e) => resumirEventos(e, 0))
    const fases = [...new Set(resumidos.filter((e) => e.tipo === 'fase').map((e) => e.fase))]
    expect(fases).toEqual(['Rastreo', 'Análisis', 'Verificación'])
    expect(resumidos.filter((e) => e.tipo === 'fin').length).toBe(1)
  })

  it('abort corta la reproducción, cierra la cola y devuelve código 143', async () => {
    const volcado = path.join(repo.raiz, 'data', 'vivas', 'c2.stream.jsonl')
    const ctl = new AbortController()
    const p = lanzarClaude({ prompt: 'x', runner: 'mock', mockDelayMs: 5, volcarA: volcado, signal: ctl.signal })
    const eventos: EventoStream[] = []
    for await (const ev of p.eventos) {
      eventos.push(ev)
      if (eventos.length === 3) ctl.abort()
    }
    const salida = await p.salida
    expect(salida.code).toBe(143)
    expect(eventos.length).toBeLessThan(10)
    expect(fs.existsSync(`${volcado}.fin`)).toBe(true)
  })
})
