import { describe, expect, it } from 'vitest'
import { parsearLineasStream, resumirEvento, type EventoCorrida } from '../src/claude/stream-json.ts'
import { leerFixture } from './helpers.ts'

const fixture = leerFixture('stream-json.sample.jsonl')

function resumirTodo(texto: string): EventoCorrida[] {
  const { eventos } = parsearLineasStream(texto)
  return eventos.map((e) => resumirEvento(e, 0)).filter((e): e is EventoCorrida => e !== null)
}

describe('stream-json', () => {
  it('parsea el fixture completo', () => {
    const r = parsearLineasStream(fixture)
    expect(r.eventos.length).toBe(148)
    expect(r.resto).toBe('')
    expect(r.descartadas).toEqual([])
  })

  it('detecta las 4 fases/etiquetas, el result con structured_output y 3 denegaciones', () => {
    const eventos = resumirTodo(fixture)
    const fases = [...new Set(eventos.filter((e) => e.tipo === 'fase').map((e) => `${e.fase}: ${e.etiqueta}`))]
    expect(fases).toEqual([
      'Rastreo: rastreo-web:Country Club RD',
      'Rastreo: rastreo-ig:todos',
      'Análisis: analista:intento-1',
      'Verificación: verificacion:intento-1',
    ])
    expect(eventos.filter((e) => e.tipo === 'denegado').map((e) => e.etiqueta)).toEqual(['Bash', 'Monitor', 'Bash'])
    const fin = eventos.filter((e) => e.tipo === 'fin')
    expect(fin.length).toBe(1)
    expect(fin[0]?.extra?.structured_output).toEqual({ verificado: true, intentos: 1, entradas: 2, igSesion: 'no-disponible' })
    expect(fin[0]?.extra?.duration_api_ms).toBe(85842)
    expect(fin[0]?.extra?.session_id).toBe('9bb59c5d-b02a-4bb8-b2fe-631fef7e3b66')
    const tools = eventos.filter((e) => e.tipo === 'tool').map((e) => e.texto)
    expect(tools).toContain('▶ Workflow corrida')
    expect(eventos.filter((e) => e.tipo === 'texto').map((e) => e.texto).join('')).toContain('Lanzo el workflow por scriptPath')
    expect(eventos.some((e) => e.tipo === 'info' && /completed/.test(e.texto))).toBe(true)
  })

  it('reensambla líneas partidas entre chunks', () => {
    const completo = parsearLineasStream(fixture).eventos
    const eventos: unknown[] = []
    let resto = ''
    const tamano = 777
    for (let i = 0; i < fixture.length; i += tamano) {
      const r = parsearLineasStream(fixture.slice(i, i + tamano), resto)
      resto = r.resto
      eventos.push(...r.eventos)
    }
    expect(eventos.length).toBe(completo.length)
    expect(eventos).toEqual(completo)
    const r = parsearLineasStream('{"type":"a"}\n{"type":"b"', '')
    expect(r.eventos.length).toBe(1)
    expect(r.resto).toBe('{"type":"b"')
    expect(parsearLineasStream('}\n', r.resto).eventos).toEqual([{ type: 'b' }])
  })

  it('ignora líneas no JSON sin lanzar', () => {
    const r = parsearLineasStream('ruido\n{"type":"x"}\n')
    expect(r.eventos).toEqual([{ type: 'x' }])
    expect(r.descartadas).toEqual(['ruido'])
  })
})
