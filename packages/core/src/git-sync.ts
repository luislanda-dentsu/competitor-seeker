// Sincronización por git entre Macs. Solo viajan `marcas/` y `config.json`
// (nunca `add -A`). Estado local en `data/sync-estado.json` (gitignored).
import fs from 'node:fs'
import path from 'node:path'
import { simpleGit, type SimpleGit } from 'simple-git'
import { fechaLocal } from './corridas.ts'
import { cargarEnv } from './env.ts'
import { emitirNotificacion } from './notificaciones.ts'
import { repoRoot, rutaDataArchivo } from './rutas.ts'

export type MotivoFalloSync = 'sin-red' | 'auth' | 'otro'

export type ResultadoSync =
  | { ok: true; omitido?: string; commit?: boolean }
  | { ok: false; motivo: 'conflicto'; archivos: string[] }
  | { ok: false; motivo: MotivoFalloSync; error: string }

export interface EstadoSync {
  remoto: boolean
  rama: string
  adelante: number
  atras: number
  /** Archivos modificados/sin commitear, solo bajo marcas/ y config.json. */
  sucio: string[]
  ultimoPull?: string
  ultimoPush?: string
  conflicto?: string[]
  error?: string
  /** Motivo por el que el sync automático está en pausa (rama de feature, código sin commitear). */
  pausado?: string
}

interface EstadoDisco {
  ultimoPull?: string
  ultimoPush?: string
  ultimoIntentoPull?: number
  conflicto?: string[]
  error?: string
}

const SIN_REMOTO: ResultadoSync = { ok: true, omitido: 'sin remoto' }

function rutaEstado(): string {
  return rutaDataArchivo('sync-estado.json')
}

function leerEstadoDisco(): EstadoDisco {
  try {
    return JSON.parse(fs.readFileSync(rutaEstado(), 'utf8')) as EstadoDisco
  } catch {
    return {}
  }
}

function guardarEstadoDisco(cambios: Partial<EstadoDisco>): void {
  try {
    const nuevo: EstadoDisco = { ...leerEstadoDisco(), ...cambios }
    for (const k of Object.keys(nuevo) as (keyof EstadoDisco)[]) if (nuevo[k] === undefined) delete nuevo[k]
    fs.mkdirSync(path.dirname(rutaEstado()), { recursive: true })
    const tmp = `${rutaEstado()}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(nuevo, null, 2), 'utf8')
    fs.renameSync(tmp, rutaEstado())
  } catch {
    /* el estado es informativo: nunca rompe la operación */
  }
}

function git(): SimpleGit {
  process.env.GIT_TERMINAL_PROMPT ??= '0' // nunca pedir credenciales por TTY
  process.env.GIT_SSH_COMMAND ??= 'ssh -o BatchMode=yes -o ConnectTimeout=10' // ni passphrase por TTY
  process.env.GIT_OPTIONAL_LOCKS ??= '0' // `status` de solo lectura no toma index.lock
  // Ninguna operación git puede bloquear la cola indefinidamente (red colgada).
  return simpleGit(repoRoot(), { timeout: { block: 30_000 } })
}

const RUTAS_DATOS = ['marcas/', 'config.json', 'usuarios.json']

/**
 * El sync solo opera en la rama de datos (`CS_GIT_RAMA`, main) y sin código sin commitear:
 * nunca rebasa ni empuja una rama de feature, ni stashea trabajo de desarrollo.
 */
async function bloqueoSync(g: SimpleGit, { exigirArbolLimpio }: { exigirArbolLimpio: boolean }): Promise<string | null> {
  const { CS_GIT_RAMA: rama } = cargarEnv()
  const actual = (await g.raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  if (actual !== rama) return `rama distinta (${actual}); el sync solo corre en ${rama}`
  if (exigirArbolLimpio) {
    const st = await g.raw(['status', '--porcelain'])
    const codigo = st
      .split('\n')
      .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
      .filter((f) => f && !RUTAS_DATOS.some((r) => f === r || f.startsWith(r)))
    if (codigo.length > 0) return `hay cambios de código sin commitear (${codigo.slice(0, 3).join(', ')}${codigo.length > 3 ? '…' : ''})`
  }
  return null
}

function esIndexLock(mensaje: string): boolean {
  return /index\.lock/i.test(mensaje)
}

/** Reintenta una vez tras 500 ms si otro proceso git tenía el index. */
async function conReintentoLock<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (!esIndexLock((e as Error).message)) throw e
    await new Promise((r) => setTimeout(r, 500))
    return fn()
  }
}

/** Rutas que viajan por git y existen en disco o están rastreadas. */
function rutasSync(): string[] {
  const raiz = repoRoot()
  return ['marcas', 'config.json', 'usuarios.json'].filter((p) => fs.existsSync(path.join(raiz, p)))
}

// Una sola operación git a la vez dentro del proceso.
let cola: Promise<unknown> = Promise.resolve()
function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const p = cola.then(fn, fn)
  cola = p.catch(() => undefined)
  return p
}

async function tieneRemoto(g: SimpleGit): Promise<boolean> {
  const remotos = await g.getRemotes()
  return remotos.some((r) => r.name === cargarEnv().CS_GIT_REMOTO)
}

export function clasificarErrorGit(mensaje: string): MotivoFalloSync {
  if (/could not resolve host|unable to access|network|timed out|timeout|could not read from remote|connection (refused|reset)|early eof|unreachable|ssl/i.test(mensaje) && !/authentication|permission denied|denied to/i.test(mensaje)) return 'sin-red'
  if (/authentication|permission denied|403|401|could not read username|denied to|invalid credentials/i.test(mensaje)) return 'auth'
  return 'otro'
}

async function archivosEnConflicto(g: SimpleGit): Promise<string[]> {
  try {
    const salida = await g.raw(['diff', '--name-only', '--diff-filter=U'])
    return salida.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

async function pullInterno(g: SimpleGit): Promise<ResultadoSync> {
  const { CS_GIT_REMOTO: remoto, CS_GIT_RAMA: rama } = cargarEnv()
  guardarEstadoDisco({ ultimoIntentoPull: Date.now() })
  const bloqueo = await bloqueoSync(g, { exigirArbolLimpio: true })
  if (bloqueo) return { ok: true, omitido: bloqueo }
  try {
    await g.fetch(remoto)
    await g.raw(['pull', '--rebase', '--autostash', remoto, rama])
    guardarEstadoDisco({ ultimoPull: new Date().toISOString(), conflicto: undefined, error: undefined })
    return { ok: true }
  } catch (e) {
    const mensaje = (e as Error).message
    const enRebase = fs.existsSync(path.join(repoRoot(), '.git', 'rebase-merge')) || fs.existsSync(path.join(repoRoot(), '.git', 'rebase-apply'))
    const archivos = await archivosEnConflicto(g)
    if (enRebase || archivos.length > 0 || /conflict/i.test(mensaje)) {
      try {
        await g.raw(['rebase', '--abort'])
      } catch {
        /* nada que abortar */
      }
      guardarEstadoDisco({ conflicto: archivos, error: undefined })
      return { ok: false, motivo: 'conflicto', archivos }
    }
    const motivo = clasificarErrorGit(mensaje)
    guardarEstadoDisco({ error: mensaje.slice(0, 300) })
    return { ok: false, motivo, error: mensaje }
  }
}

export interface OpcionesSync {
  /** Llamada automática: respeta `CS_SYNC_AUTO`. */
  auto?: boolean
}

function autoDesactivado(o?: OpcionesSync): boolean {
  return o?.auto === true && !cargarEnv().CS_SYNC_AUTO
}

/** `fetch` + `pull --rebase --autostash`. Ante conflicto aborta el rebase y deja el árbol limpio. */
export function pull(o?: OpcionesSync): Promise<ResultadoSync> {
  if (autoDesactivado(o)) return Promise.resolve({ ok: true, omitido: 'sync automático desactivado' })
  return enCola(async () => {
    const g = git()
    if (!(await tieneRemoto(g))) return SIN_REMOTO
    return pullInterno(g)
  })
}

/** Pull solo si pasaron `ms` desde el último intento (por defecto 60 s). */
export function pullSiToca(ms = 60_000, o: OpcionesSync = { auto: true }): Promise<ResultadoSync> {
  const ultimo = leerEstadoDisco().ultimoIntentoPull
  if (ultimo !== undefined && Date.now() - ultimo < ms) return Promise.resolve({ ok: true, omitido: 'throttle' })
  return pull(o)
}

function notificarErrorPush(mensaje: string): void {
  try {
    emitirNotificacion({
      tipo: 'git-error',
      nivel: 'aviso',
      titulo: 'No se pudo subir a git',
      mensaje: mensaje.slice(0, 300),
      clave: `git-error-${clasificarErrorGit(mensaje)}-${fechaLocal(new Date())}`,
      href: '/',
    })
  } catch {
    /* sin notificación no se rompe nada */
  }
}

/** `add` solo de marcas/ y config.json, commit si hay cambios y push. Un commit fallido de push queda local. */
export function commitYPush(mensaje: string, o?: OpcionesSync): Promise<ResultadoSync> {
  if (autoDesactivado(o)) return Promise.resolve({ ok: true, omitido: 'sync automático desactivado' })
  return enCola(async () => {
    const g = git()
    if (!(await tieneRemoto(g))) return SIN_REMOTO
    const { CS_GIT_REMOTO: remoto, CS_GIT_RAMA: rama } = cargarEnv()
    const bloqueo = await bloqueoSync(g, { exigirArbolLimpio: false })
    if (bloqueo) return { ok: true, omitido: bloqueo }
    let hizoCommit = false
    try {
      const rutas = rutasSync()
      if (rutas.length > 0) {
        await conReintentoLock(() => g.raw(['add', '--', ...rutas]))
        const staged = (await g.raw(['diff', '--cached', '--name-only', '--', ...rutas])).trim()
        if (staged) {
          await conReintentoLock(() => g.raw(['commit', '-m', mensaje, '--', ...rutas]))
          hizoCommit = true
        }
      }
    } catch (e) {
      const error = (e as Error).message
      guardarEstadoDisco({ error: error.slice(0, 300) })
      if (!esIndexLock(error)) notificarErrorPush(error)
      return { ok: false, motivo: 'otro', error }
    }

    const empujar = async (): Promise<void> => {
      await g.raw(['push', remoto, `HEAD:${rama}`])
    }
    try {
      await empujar()
    } catch (e) {
      const error = (e as Error).message
      if (/rejected|non-fast-forward|fetch first|failed to push some refs/i.test(error) && clasificarErrorGit(error) === 'otro') {
        const r = await pullInterno(g)
        if (!r.ok) {
          if (r.motivo !== 'conflicto') notificarErrorPush(r.error)
          return r
        }
        try {
          await empujar()
        } catch (e2) {
          return falloPush(e2 as Error)
        }
      } else {
        return falloPush(e as Error)
      }
    }
    guardarEstadoDisco({ ultimoPush: new Date().toISOString(), error: undefined })
    return { ok: true, commit: hizoCommit }
  })
}

function falloPush(e: Error): ResultadoSync {
  const motivo = clasificarErrorGit(e.message)
  guardarEstadoDisco({ error: e.message.slice(0, 300) })
  notificarErrorPush(e.message)
  return { ok: false, motivo, error: e.message }
}

export async function estadoSync(): Promise<EstadoSync> {
  const disco = leerEstadoDisco()
  const base = {
    ...(disco.ultimoPull ? { ultimoPull: disco.ultimoPull } : {}),
    ...(disco.ultimoPush ? { ultimoPush: disco.ultimoPush } : {}),
    ...(disco.conflicto && disco.conflicto.length > 0 ? { conflicto: disco.conflicto } : {}),
    ...(disco.error ? { error: disco.error } : {}),
  }
  try {
    const g = git()
    const { CS_GIT_REMOTO: remoto, CS_GIT_RAMA: rama } = cargarEnv()
    const remotoOk = await tieneRemoto(g)
    let ramaActual = rama
    try {
      ramaActual = (await g.raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim() || rama
    } catch {
      /* repo sin commits */
    }
    let sucio: string[] = []
    try {
      const rutas = rutasSync()
      if (rutas.length > 0) {
        const s = await g.raw(['status', '--porcelain', '-uall', '--', ...rutas])
        sucio = s.split('\n').filter(Boolean).map((l) => l.slice(3).trim())
      }
    } catch {
      /* se informa vacío */
    }
    let adelante = 0
    let atras = 0
    if (remotoOk) {
      try {
        const c = (await g.raw(['rev-list', '--left-right', '--count', `HEAD...${remoto}/${rama}`])).trim().split(/\s+/)
        adelante = Number(c[0]) || 0
        atras = Number(c[1]) || 0
      } catch {
        /* rama remota aún inexistente */
      }
    }
    let pausado: string | null = null
    try {
      pausado = await bloqueoSync(g, { exigirArbolLimpio: true })
    } catch {
      /* repo sin commits */
    }
    return { remoto: remotoOk, rama: ramaActual, adelante, atras, sucio, ...base, ...(pausado ? { pausado } : {}) }
  } catch (e) {
    return { remoto: false, rama: cargarEnv().CS_GIT_RAMA, adelante: 0, atras: 0, sucio: [], ...base, error: (e as Error).message }
  }
}
