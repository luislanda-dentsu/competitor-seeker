#!/usr/bin/env node
// Hook PreToolUse de los `claude -p` headless (corridas y chat), cargado desde
// .claude/settings.headless.json. Listas blancas, no negras:
// · chrome-devtools: solo las herramientas que usa el rastreador-ig, sin parámetros de archivo
//   (filePath, sourcePath…) ni initScript, y new_page/navigate_page solo a Instagram;
//   la red del navegador la acota además --allowedUrlPattern en scripts/chrome-ig.sh;
// · WebFetch: solo http(s) públicos (resuelve el DNS: nada de loopback ni red local);
// · Read/Grep/Glob: la corrida solo dentro del repo (sin data/, .env*, settings) y su carpeta
//   temporal de Claude; el asistente (CS_ROL_AGENTE=asistente) solo marcas/ y soul.md.
// Falla cerrado: entrada rara, rol desconocido o excepción → deniega (y el comando hace `|| exit 2`).
import dns from 'node:dns/promises'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROLES = new Set(['corrida', 'asistente'])
const HOSTS_IG = /^(?:[a-z0-9-]+\.)*instagram\.com$/
const TOOLS_NAVEGADOR = new Set([
  'new_page', 'navigate_page', 'select_page', 'list_pages', 'close_page',
  'take_snapshot', 'take_screenshot', 'evaluate_script', 'wait_for', 'click', 'hover', 'press_key',
])

/** IP o nombre que apunta a la propia Mac o a la red local. */
export function hostPrivado(host) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!h.includes('.') && !h.includes(':')) return true // «localhost», nombres de la LAN
  if (h === 'localhost' || /\.(localhost|local|internal|lan|home|arpa)$/.test(h)) return true
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  if (h.includes(':')) {
    // ::1, ::, IPv4 compatibles/mapeadas (::7f00:1, ::ffff:…), NAT64, ULA, link-local, multicast.
    return h.startsWith('::') || h.startsWith('64:ff9b:') || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('ff')
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

function urlInstagram(url) {
  if (url === 'about:blank') return true
  const u = parsearUrl(url)
  return !!u && u.protocol === 'https:' && !u.username && !u.password && HOSTS_IG.test(u.hostname.toLowerCase())
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

/** Carpetas temporales de Claude Code (salida del Workflow): /tmp/claude-<uid>/… */
function enTemporalClaude(ruta) {
  return /^\/(private\/)?tmp\/claude-\d+(\/|$)/.test(ruta)
}

function rutaPermitida(ruta, rol, base) {
  if (rol === 'asistente') return dentro(ruta, path.join(base, 'marcas')) || ruta === path.join(base, 'soul.md')
  if (enTemporalClaude(ruta)) return true
  if (!dentro(ruta, base)) return false
  const rel = path.relative(base, ruta)
  const primero = rel.split(path.sep)[0]
  return !(primero === 'data' || primero === 'node_modules' || primero.startsWith('.env') || /^\.claude\/settings/.test(rel))
}

function motivoArchivo(tool, input, rol, raiz) {
  const base = rutaReal(raiz)
  if (tool === 'Glob') {
    const patron = String(input.pattern ?? '')
    if (path.isAbsolute(patron) || patron.startsWith('~') || patron.split(/[\\/]/).includes('..')) {
      return 'Glob: usa un patrón relativo dentro del proyecto'
    }
  }
  const pedida = input.file_path ?? input.path ?? raiz
  const ruta = rutaReal(path.resolve(raiz, String(pedida)))
  // Un Grep sobre la raíz recorrería .env.local y data/: debe apuntar a una subcarpeta o archivo.
  if (tool === 'Grep' && rol === 'corrida' && ruta === base) return 'Grep: indica una subcarpeta (p. ej. marcas/<slug>), no la raíz del proyecto'
  if (rutaPermitida(ruta, rol, base)) return null
  return rol === 'asistente'
    ? 'El asistente solo puede leer marcas/ y soul.md (indica la ruta, p. ej. marcas/<slug>/log.jsonl)'
    : 'Solo se puede leer dentro del proyecto (sin data/, .env* ni settings)'
}

function motivoNavegador(accion, input) {
  if (!TOOLS_NAVEGADOR.has(accion)) return `El navegador es solo lectura: ${accion} no está permitido`
  const claveArchivo = Object.keys(input).find((k) => /path$/i.test(k) || k === 'initScript')
  if (claveArchivo) return `El navegador no puede leer ni escribir archivos (${claveArchivo})`
  if ((accion === 'navigate_page' || accion === 'new_page') && input.url !== undefined && !urlInstagram(input.url)) {
    return 'El navegador solo puede abrir https://www.instagram.com/'
  }
  return null
}

async function motivoWebFetch(url, resolver) {
  const u = parsearUrl(url)
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || hostPrivado(u.hostname)) {
    return 'WebFetch solo admite webs públicas http(s): nada de file:, localhost ni redes privadas'
  }
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (/^[\d.]+$/.test(host) || host.includes(':')) return null // IP literal ya comprobada
  let ips
  try {
    ips = await resolver(host.replace(/\.$/, ''))
  } catch {
    return `WebFetch: no se pudo resolver ${host}`
  }
  return ips.some((ip) => hostPrivado(ip)) ? `WebFetch: ${host} apunta a una dirección local o privada` : null
}

const resolverDns = async (host) => (await dns.lookup(host, { all: true, verbatim: true })).map((r) => r.address)

/** Devuelve el motivo de la denegación o null si la herramienta puede usarse. */
export async function evaluar(entrada, { rol = 'corrida', raiz, resolver = resolverDns }) {
  if (!ROLES.has(rol)) return `Rol de agente desconocido: ${rol}`
  if (!entrada || typeof entrada !== 'object' || typeof entrada.tool_name !== 'string') return 'Entrada del hook no válida'
  if (!raiz) return 'Sin raíz del proyecto'
  const tool = entrada.tool_name
  const input = entrada.tool_input && typeof entrada.tool_input === 'object' ? entrada.tool_input : {}

  if (tool === 'WebFetch') return motivoWebFetch(input.url, resolver)
  if (tool.startsWith('mcp__chrome-devtools__')) return motivoNavegador(tool.slice('mcp__chrome-devtools__'.length), input)
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') return motivoArchivo(tool, input, rol, raiz)
  return null
}

function denegar(motivo) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } }),
  )
}

async function main() {
  let texto = ''
  for await (const c of process.stdin) texto += c
  let entrada = null
  try {
    entrada = JSON.parse(texto)
  } catch {
    /* falla cerrado en evaluar */
  }
  const raiz = process.env.CLAUDE_PROJECT_DIR || entrada?.cwd
  const motivo = await evaluar(entrada, { rol: process.env.CS_ROL_AGENTE || 'corrida', raiz })
  if (motivo) denegar(motivo)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === rutaReal(process.argv[1])) {
  main().catch((e) => {
    process.stderr.write(`guardia-agentes: ${e?.message ?? e}\n`)
    process.exit(2)
  })
}
