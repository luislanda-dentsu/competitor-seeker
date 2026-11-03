import { describe, expect, it } from 'vitest'
import { argsClaude } from '../src/claude/runner.ts'
import { promptAsistente } from '../src/claude/prompts.ts'

describe('argsClaude', () => {
  it('--chrome solo por defecto para el orquestador (sin agent)', () => {
    expect(argsClaude({ prompt: 'p' })).toContain('--chrome')
    expect(argsClaude({ prompt: 'p', chrome: false })).not.toContain('--chrome')
    expect(argsClaude({ prompt: 'p', agent: 'asistente' })).not.toContain('--chrome')
    expect(argsClaude({ prompt: 'p', agent: 'rastreador-ig', chrome: true })).toContain('--chrome')
  })

  it('una invocación del asistente no lleva --chrome', () => {
    const args = argsClaude({ prompt: promptAsistente({ marca: 'k', contexto: '-', pregunta: '¿Qué pasó?' }), agent: 'asistente' })
    expect(args).not.toContain('--chrome')
    expect(args).toContain('--agent')
    expect(args[args.indexOf('--agent') + 1]).toBe('asistente')
  })

  it('sessionId y resume son excluyentes; json-schema se serializa', () => {
    expect(() => argsClaude({ prompt: 'p', sessionId: 'a', resume: 'b' })).toThrow(/excluyentes/)
    const args = argsClaude({ prompt: 'p', jsonSchema: { type: 'object' }, name: 'n' })
    expect(args[args.indexOf('--json-schema') + 1]).toBe('{"type":"object"}')
    expect(args[args.indexOf('--name') + 1]).toBe('n')
  })
})
