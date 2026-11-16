import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluar, hostPrivado } from './guardia-agentes.mjs'

const raiz = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guardia-')))
fs.mkdirSync(path.join(raiz, 'marcas', 'parval'), { recursive: true })
fs.writeFileSync(path.join(raiz, 'soul.md'), '')
const corrida = { rol: 'corrida', raiz }
const asistente = { rol: 'asistente', raiz }
const t = (tool_name, tool_input) => ({ tool_name, tool_input })

describe('guardia de agentes headless', () => {
  it('detecta hosts locales y privados', () => {
    for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.16.51', '172.20.0.1', '169.254.169.254', '[::1]', 'fd00::1', 'mac.local', 'intranet']) {
      expect(hostPrivado(h), h).toBe(true)
    }
    for (const h of ['www.parval.com.do', '8.8.8.8', 'instagram.com']) expect(hostPrivado(h), h).toBe(false)
  })

  it('WebFetch: solo webs públicas http(s)', () => {
    expect(evaluar(t('WebFetch', { url: 'https://www.parval.com.do/' }), corrida)).toBeNull()
    for (const url of ['file:///etc/passwd', 'http://localhost:3030/api/apify', 'http://2130706433/', 'http://192.168.16.51:3030', 'ftp://x.com', 'nada']) {
      expect(evaluar(t('WebFetch', { url }), corrida), url).toMatch(/WebFetch/)
    }
  })

  it('chrome-devtools: solo Instagram y sin subir archivos', () => {
    expect(evaluar(t('mcp__chrome-devtools__new_page', { url: 'https://www.instagram.com/parvalrd/' }), corrida)).toBeNull()
    expect(evaluar(t('mcp__chrome-devtools__navigate_page', { type: 'back' }), corrida)).toBeNull()
    expect(evaluar(t('mcp__chrome-devtools__take_snapshot', {}), corrida)).toBeNull()
    for (const url of ['file:///Users/x/competitor-seeker/.env.local', 'http://localhost:3030', 'https://evil.com/?q=1', 'https://instagram.com.evil.com/', 'http://www.instagram.com/']) {
      expect(evaluar(t('mcp__chrome-devtools__navigate_page', { type: 'url', url }), corrida), url).toMatch(/instagram/)
    }
    expect(evaluar(t('mcp__chrome-devtools__upload_file', { filePath: '/x' }), corrida)).toMatch(/archivos/)
  })

  it('asistente: solo marcas/ y soul.md', () => {
    expect(evaluar(t('Read', { file_path: path.join(raiz, 'marcas/parval/log.jsonl') }), asistente)).toBeNull()
    expect(evaluar(t('Read', { file_path: 'soul.md' }), asistente)).toBeNull()
    expect(evaluar(t('Grep', { pattern: 'x', path: 'marcas/parval' }), asistente)).toBeNull()
    for (const file_path of ['.env.local', '../orbit/.dev.vars', 'marcas/../data/secrets.json', '/etc/hosts', 'CLAUDE.md']) {
      expect(evaluar(t('Read', { file_path }), asistente), file_path).toMatch(/asistente/)
    }
    expect(evaluar(t('Grep', { pattern: 'AUTH_SECRET' }), asistente)).toMatch(/asistente/)
  })

  it('asistente: un symlink dentro de marcas/ que sale fuera se deniega', () => {
    fs.symlinkSync(os.tmpdir(), path.join(raiz, 'marcas', 'fuga'))
    expect(evaluar(t('Read', { file_path: 'marcas/fuga/x' }), asistente)).toMatch(/asistente/)
  })

  it('la corrida conserva Read (lo acotan las reglas deny) y falla cerrado con entrada inválida', () => {
    expect(evaluar(t('Read', { file_path: 'CLAUDE.md' }), corrida)).toBeNull()
    expect(evaluar(null, corrida)).toMatch(/no válida/)
  })
})
