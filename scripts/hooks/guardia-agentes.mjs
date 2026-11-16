#!/usr/bin/env node
// Hook PreToolUse de los `claude -p` headless (corridas y chat), cargado desde
// .claude/settings.headless.json. Cierra lo que las reglas `deny` no cubren:
// · el navegador (chrome-devtools) solo abre Instagram: nada de file://, localhost ni otras webs;
// · WebFetch solo a http(s) públicos (nada de file:, localhost ni redes privadas);
// · el asistente del chat (CS_ROL_AGENTE=asistente) solo lee marcas/ y soul.md.
// Falla cerrado: si la entrada no se entiende, deniega.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HOSTS_IG = /^(?:[a-z0-9-]+\.)*instagram\.com$/

/** IP o nombre que apunta a la propia Mac o a la red local. */
export function hostPrivado(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (!h.includes('.') && !h.includes(':')) return true // «localhost», nombres de la LAN
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  if (h.includes(':')) {
    return h === '::' || h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:')
  }
  return false
}

function parsearUrl(url) {
  try {
    return new URL(String(url))
  } catch {
    return null
  }
}

function urlWebPublica(url) {
  const u = parsearUrl(url)
  return !!u && (u.protocol === 'https:' || u.protocol === 'http:') && !hostPrivado(u.hostname)
}

function urlInstagram(url) {
  if (url === 'about:blank') return true
  const u = parsearUrl(url)
  return !!u && u.protocol === 'https:' && HOSTS_IG.test(u.hostname.toLowerCase())
}

function rutaReal(p) {
  try {
    return fs.realpathSync(p)
  } catch {
    // Aún no existe: resuelve el directorio padre (evita symlinks en la ruta).
    const padre = path.dirname(p)
    return padre === p ? p : path.join(rutaReal(padre), path.basename(p))
  }
}

function dentro(ruta, base) {
  const rel = path.relative(base, ruta)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Devuelve el motivo de la denegación o null si la herramienta puede usarse. */
export function evaluar(entrada, { rol = 'corrida', raiz }) {
  if (!entrada || typeof entrada !== 'object' || typeof entrada.tool_name !== 'string') return 'Entrada del hook no válida'
  const tool = entrada.tool_name
  const input = entrada.tool_input && typeof entrada.tool_input === 'object' ? entrada.tool_input : {}

  if (tool === 'WebFetch') {
    return urlWebPublica(input.url) ? null : 'WebFetch solo admite webs públicas http(s): nada de file:, localhost ni redes privadas'
  }
  if (tool.startsWith('mcp__chrome-devtools__')) {
    const accion = tool.slice('mcp__chrome-devtools__'.length)
    if (accion === 'upload_file') return 'El navegador es solo lectura: no se suben archivos'
    if ((accion === 'navigate_page' || accion === 'new_page') && input.url !== undefined && !urlInstagram(input.url)) {
      return 'El navegador solo puede abrir https://www.instagram.com/'
    }
    return null
  }
  if (rol === 'asistente' && (tool === 'Read' || tool === 'Grep' || tool === 'Glob')) {
    const base = rutaReal(raiz)
    const pedida = input.file_path ?? input.path ?? raiz
    const ruta = rutaReal(path.resolve(raiz, String(pedida)))
    const permitida = dentro(ruta, path.join(base, 'marcas')) || ruta === path.join(base, 'soul.md')
    return permitida ? null : 'El asistente solo puede leer marcas/ y soul.md (indica la ruta, p. ej. marcas/<slug>/log.jsonl)'
  }
  return null
}

function denegar(motivo) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } }),
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === rutaReal(process.argv[1])) {
  let texto = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => (texto += c))
  process.stdin.on('end', () => {
    let entrada = null
    try {
      entrada = JSON.parse(texto)
    } catch {
      /* falla cerrado abajo */
    }
    const raiz = process.env.CLAUDE_PROJECT_DIR || entrada?.cwd || process.cwd()
    const motivo = evaluar(entrada, { rol: process.env.CS_ROL_AGENTE || 'corrida', raiz })
    if (motivo) denegar(motivo)
  })
}
