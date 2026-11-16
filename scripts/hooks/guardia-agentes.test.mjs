import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { evaluar, hostPrivado } from './guardia-agentes.mjs'

const raiz = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guardia-')))
fs.mkdirSync(path.join(raiz, 'marcas', 'parval'), { recursive: true })
fs.mkdirSync(path.join(raiz, 'data'))
fs.writeFileSync(path.join(raiz, 'soul.md'), '')
const dnsFalso = async (host) => ({ 'www.parval.com.do': ['104.21.1.1'], 'localtest.me': ['127.0.0.1'], 'x.nip.io': ['192.168.1.5'] })[host] ?? Promise.reject(new Error('NXDOMAIN'))
const corrida = { rol: 'corrida', raiz, resolver: dnsFalso }
const asistente = { rol: 'asistente', raiz, resolver: dnsFalso }
const t = (tool_name, tool_input) => ({ tool_name, tool_input })
const nav = (accion, input) => t(`mcp__chrome-devtools__${accion}`, input)

describe('guardia de agentes headless', () => {
  it('detecta hosts locales y privados', () => {
    for (const h of ['localhost', 'localhost.', '127.0.0.1', '10.1.2.3', '192.168.16.51', '172.20.0.1', '169.254.169.254', '[::1]', '[::7f00:1]', '[::ffff:7f00:1]', '64:ff9b::7f00:1', 'fd00::1', 'mac.local', 'intranet']) {
      expect(hostPrivado(h), h).toBe(true)
    }
    for (const h of ['www.parval.com.do', '8.8.8.8', 'instagram.com', '2606:4700::1']) expect(hostPrivado(h), h).toBe(false)
  })

  it('WebFetch: solo webs públicas http(s), también tras resolver el DNS', async () => {
    expect(await evaluar(t('WebFetch', { url: 'https://www.parval.com.do/' }), corrida)).toBeNull()
    for (const url of ['file:///etc/passwd', 'http://localhost:3030/api/apify', 'http://localhost.:3040/', 'http://2130706433/', 'http://0x7f.1/', 'http://[::127.0.0.1]/', 'http://192.168.16.51:3030', 'https://u:p@www.parval.com.do/', 'ftp://x.com', 'nada']) {
      expect(await evaluar(t('WebFetch', { url }), corrida), url).toMatch(/WebFetch/)
    }
    expect(await evaluar(t('WebFetch', { url: 'https://localtest.me/' }), corrida)).toMatch(/privada/)
    expect(await evaluar(t('WebFetch', { url: 'https://x.nip.io/' }), corrida)).toMatch(/privada/)
    expect(await evaluar(t('WebFetch', { url: 'https://no-existe.example/' }), corrida)).toMatch(/resolver/)
  })

  it('chrome-devtools: lista blanca de herramientas, solo Instagram y sin archivos', async () => {
    expect(await evaluar(nav('new_page', { url: 'https://www.instagram.com/parvalrd/' }), corrida)).toBeNull()
    expect(await evaluar(nav('navigate_page', { type: 'back' }), corrida)).toBeNull()
    expect(await evaluar(nav('take_snapshot', {}), corrida)).toBeNull()
    expect(await evaluar(nav('evaluate_script', { function: '() => document.title' }), corrida)).toBeNull()
    for (const url of ['file:///Users/x/.env.local', 'http://localhost:3040', 'https://evil.com/', 'https://instagram.com.evil.com/', 'https://instagram.com@evil.com/', 'http://www.instagram.com/', 'view-source:file:///etc/hosts', 'javascript:alert(1)']) {
      expect(await evaluar(nav('navigate_page', { type: 'url', url }), corrida), url).toMatch(/instagram/)
    }
    // Escritura/lectura de archivos por cualquier parámetro *Path, e initScript.
    expect(await evaluar(nav('evaluate_script', { function: '()=>({})', filePath: 'usuarios.json' }), corrida)).toMatch(/archivos \(filePath\)/)
    expect(await evaluar(nav('take_snapshot', { filePath: '.mcp.json' }), corrida)).toMatch(/archivos/)
    expect(await evaluar(nav('evaluate_script', { sourcePath: '.env.local' }), corrida)).toMatch(/archivos/)
    expect(await evaluar(nav('navigate_page', { type: 'reload', initScript: 'location="http://localhost:3040"' }), corrida)).toMatch(/archivos \(initScript\)/)
    for (const accion of ['upload_file', 'take_heapsnapshot', 'lighthouse_audit', 'performance_start_trace', 'screencast_start', 'get_network_request', 'fill', 'emulate']) {
      expect(await evaluar(nav(accion, {}), corrida), accion).toMatch(/no está permitido/)
    }
  })

  it('corrida: solo dentro del proyecto y su temporal de Claude', async () => {
    expect(await evaluar(t('Read', { file_path: 'CLAUDE.md' }), corrida)).toBeNull()
    expect(await evaluar(t('Read', { file_path: 'marcas/parval/marca.json' }), corrida)).toBeNull()
    expect(await evaluar(t('Read', { file_path: '/private/tmp/claude-502/proyecto/tasks/x.output' }), corrida)).toBeNull()
    expect(await evaluar(t('Grep', { pattern: 'x', path: 'marcas' }), corrida)).toBeNull()
    expect(await evaluar(t('Glob', { pattern: 'marcas/*/marca.json' }), corrida)).toBeNull()
    for (const file_path of ['.env.local', 'data/secrets.json', '.claude/settings.headless.json', '../advantio/config/agencia.env', '/etc/hosts', path.join(os.homedir(), '.ssh/id_ed25519'), '/tmp/otra-cosa']) {
      expect(await evaluar(t('Read', { file_path }), corrida), file_path).toMatch(/proyecto/)
    }
    expect(await evaluar(t('Grep', { pattern: 'AUTH_SECRET' }), corrida)).toMatch(/subcarpeta/)
    expect(await evaluar(t('Grep', { pattern: 'x', path: 'data' }), corrida)).toMatch(/proyecto/)
    for (const pattern of ['/Users/**/*.env', '../**/*.env', '~/.ssh/*']) {
      expect(await evaluar(t('Glob', { pattern }), corrida), pattern).toMatch(/relativo/)
    }
  })

  it('asistente: solo marcas/ y soul.md', async () => {
    expect(await evaluar(t('Read', { file_path: path.join(raiz, 'marcas/parval/log.jsonl') }), asistente)).toBeNull()
    expect(await evaluar(t('Read', { file_path: 'soul.md' }), asistente)).toBeNull()
    expect(await evaluar(t('Grep', { pattern: 'x', path: 'marcas/parval' }), asistente)).toBeNull()
    for (const file_path of ['.env.local', '../orbit/.dev.vars', 'marcas/../data/secrets.json', '/etc/hosts', 'CLAUDE.md', '/private/tmp/claude-502/x']) {
      expect(await evaluar(t('Read', { file_path }), asistente), file_path).toMatch(/asistente/)
    }
    expect(await evaluar(t('Grep', { pattern: 'AUTH_SECRET' }), asistente)).toMatch(/asistente/)
  })

  it('un symlink dentro de marcas/ que sale fuera se deniega', async () => {
    fs.symlinkSync(os.tmpdir(), path.join(raiz, 'marcas', 'fuga'))
    expect(await evaluar(t('Read', { file_path: 'marcas/fuga/x' }), asistente)).toMatch(/asistente/)
    expect(await evaluar(t('Read', { file_path: 'marcas/fuga/x' }), corrida)).toMatch(/proyecto/)
  })

  it('falla cerrado: rol desconocido, entrada inválida, sin raíz', async () => {
    expect(await evaluar(t('Read', { file_path: 'CLAUDE.md' }), { ...corrida, rol: 'admin' })).toMatch(/Rol/)
    expect(await evaluar(null, corrida)).toMatch(/no válida/)
    expect(await evaluar(t('Read', { file_path: 'x' }), { rol: 'corrida' })).toMatch(/raíz/)
  })

  it('como proceso: deniega con JSON y sale con error ante stdin vacío', () => {
    const script = fileURLToPath(new URL('./guardia-agentes.mjs', import.meta.url))
    const env = { ...process.env, CLAUDE_PROJECT_DIR: raiz, CS_ROL_AGENTE: 'asistente' }
    const r = spawnSync('node', [script], { input: JSON.stringify(t('Read', { file_path: '.env.local' })), env, encoding: 'utf8' })
    expect(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision).toBe('deny')
    const vacio = spawnSync('node', [script], { input: '', env, encoding: 'utf8' })
    expect(JSON.parse(vacio.stdout).hookSpecificOutput.permissionDecision).toBe('deny')
    const ok = spawnSync('node', [script], { input: JSON.stringify(t('Read', { file_path: 'soul.md' })), env, encoding: 'utf8' })
    expect(ok.stdout).toBe('')
    expect(ok.status).toBe(0)
  })
})
