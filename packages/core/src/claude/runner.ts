// Lanza `claude -p` en modo headless y expone su stream-json como eventos.
// Con `CS_RUNNER=mock` reproduce `mock-stream.jsonl` sin gastar tokens.
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cargarEnv } from '../env.ts'
import { repoRoot } from '../rutas.ts'
import { parsearLineasStream, type EventoStream } from './stream-json.ts'

export interface OpcionesClaude {
  prompt: string
  allowedTools?: readonly string[]
  disallowedTools?: readonly string[]
  /** `--session-id` (nueva sesión con id fijo). Excluyente con `resume`. */
  sessionId?: string
  /** `--resume <id>` para continuar una sesión. */
  resume?: string
  agent?: string
  /**
   * `--chrome` (Claude in Chrome). Por defecto solo para el orquestador (sin
   * `agent`); un agente como el asistente no navega y no lo lleva.
   */
  chrome?: boolean
  /** Objeto o string JSON para `--json-schema`. */
  jsonSchema?: Record<string, unknown> | string
  name?: string
  /** Ruta donde volcar cada línea cruda (append). Al terminar se crea `<ruta>.fin`. */
  volcarA?: string
  signal?: AbortSignal
  /** Fuerza runner mock/real sin tocar el entorno (por defecto, `CS_RUNNER`). */
  runner?: 'real' | 'mock'
  /** Retardo entre líneas del mock (ms). */
  mockDelayMs?: number
}

export interface SalidaClaude {
  code: number | null
  structured?: unknown
  sessionId?: string
  /** Texto final de `result` cuando no hay salida estructurada. */
  resultado?: string
  isError?: boolean
}

export interface ProcesoClaude {
  proceso: ChildProcess | null
  args: string[]
  eventos: AsyncIterable<EventoStream>
  salida: Promise<SalidaClaude>
}

export const MOCK_STREAM = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mock-stream.jsonl')

export function argsClaude(o: OpcionesClaude): string[] {
  const args = [
    '-p',
    o.prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--forward-subagent-text',
    '--permission-mode',
    'dontAsk',
    '--permission-prompts',
    'none',
    '--settings',
    '.claude/settings.headless.json',
  ]
  if (o.chrome ?? o.agent === undefined) args.push('--chrome')
  if (o.allowedTools?.length) args.push('--allowedTools', ...o.allowedTools)
  if (o.disallowedTools?.length) args.push('--disallowedTools', ...o.disallowedTools)
  if (o.sessionId && o.resume) throw new Error('sessionId y resume son excluyentes')
  if (o.sessionId) args.push('--session-id', o.sessionId)
  if (o.resume) args.push('--resume', o.resume)
  if (o.agent) args.push('--agent', o.agent)
  if (o.jsonSchema) args.push('--json-schema', typeof o.jsonSchema === 'string' ? o.jsonSchema : JSON.stringify(o.jsonSchema))
  if (o.name) args.push('--name', o.name)
  return args
}

/** Cola asíncrona mínima: productor push/cerrar, consumidor `for await`. */
class Cola<T> implements AsyncIterable<T> {
  private items: T[] = []
  private esperando: ((r: IteratorResult<T>) => void)[] = []
  private cerrada = false

  push(item: T): void {
    if (this.cerrada) return
    const w = this.esperando.shift()
    if (w) w({ value: item, done: false })
    else this.items.push(item)
  }

  cerrar(): void {
    this.cerrada = true
    for (const w of this.esperando.splice(0)) w({ value: undefined as never, done: true })
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const item = this.items.shift()
        if (item !== undefined) return Promise.resolve({ value: item, done: false })
        if (this.cerrada) return Promise.resolve({ value: undefined as never, done: true })
        return new Promise((resolve) => this.esperando.push(resolve))
      },
    }
  }
}

interface Volcado {
  linea(l: string): void
  fin(): void
}

function abrirVolcado(ruta: string | undefined): Volcado {
  if (!ruta) return { linea: () => {}, fin: () => {} }
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  const fd = fs.openSync(ruta, 'a')
  return {
    linea: (l) => fs.writeSync(fd, l + '\n'),
    fin: () => {
      fs.closeSync(fd)
      fs.writeFileSync(`${ruta}.fin`, new Date().toISOString() + '\n')
    },
  }
}

/** Acumula lo relevante de cada evento para `salida`. */
function acumular(estado: SalidaClaude, ev: EventoStream): void {
  if (ev.type === 'system' && ev.subtype === 'init' && typeof ev.session_id === 'string') estado.sessionId = ev.session_id
  if (ev.type === 'result') {
    if (typeof ev.session_id === 'string') estado.sessionId = ev.session_id
    if (ev.structured_output !== undefined) estado.structured = ev.structured_output
    if (typeof ev.result === 'string') estado.resultado = ev.result
    if (typeof ev.is_error === 'boolean') estado.isError = ev.is_error
  }
}

/**
 * Manda `senal` al grupo de procesos del hijo (lanzado con `detached: true`,
 * el hijo es líder de su grupo: así caen también sus subprocesos). Si el grupo
 * ya no existe, false.
 */
export function matarGrupo(pid: number | undefined, senal: NodeJS.Signals = 'SIGTERM'): boolean {
  if (!pid) return false
  try {
    process.kill(-pid, senal)
    return true
  } catch {
    try {
      process.kill(pid, senal)
      return true
    } catch {
      return false
    }
  }
}

export function lanzarClaude(o: OpcionesClaude): ProcesoClaude {
  const env = cargarEnv()
  const modo = o.runner ?? env.CS_RUNNER
  const args = argsClaude(o)
  return modo === 'mock' ? lanzarMock(o, args) : lanzarReal(o, args, env.CLAUDE_BIN)
}

function lanzarReal(o: OpcionesClaude, args: string[], bin: string): ProcesoClaude {
  const cola = new Cola<EventoStream>()
  const estado: SalidaClaude = { code: null }
  const volcado = abrirVolcado(o.volcarA)
  // `detached`: el hijo lidera su propio grupo de procesos para poder cancelar
  // el árbol entero (claude + subagentes + navegador) con `process.kill(-pid)`.
  const proceso = spawn(bin, args, { cwd: repoRoot(), stdio: ['ignore', 'pipe', 'pipe'], env: process.env, detached: true })
  let resto = ''
  const stderr: string[] = []

  proceso.stdout?.setEncoding('utf8')
  proceso.stdout?.on('data', (chunk: string) => {
    const r = parsearLineasStream(chunk, resto)
    resto = r.resto
    for (const ev of r.eventos) {
      volcado.linea(JSON.stringify(ev))
      acumular(estado, ev)
      cola.push(ev)
    }
    for (const d of r.descartadas) volcado.linea(JSON.stringify({ type: 'cs_descartada', texto: d }))
  })
  proceso.stderr?.setEncoding('utf8')
  proceso.stderr?.on('data', (c: string) => stderr.push(c))

  const onAbort = () => {
    if (proceso.exitCode !== null || proceso.killed) return
    matarGrupo(proceso.pid, 'SIGTERM')
    const t = setTimeout(() => { if (proceso.exitCode === null) matarGrupo(proceso.pid, 'SIGKILL') }, 5000)
    t.unref?.()
    proceso.once('close', () => clearTimeout(t))
  }
  if (o.signal) {
    if (o.signal.aborted) onAbort()
    else o.signal.addEventListener('abort', onAbort, { once: true })
  }

  const salida = new Promise<SalidaClaude>((resolve, reject) => {
    proceso.on('error', (e) => {
      volcado.linea(JSON.stringify({ type: 'cs_error', texto: e.message }))
      volcado.fin()
      cola.cerrar()
      reject(new Error(`No se pudo lanzar ${bin}: ${e.message}`))
    })
    proceso.on('close', (code) => {
      if (resto.trim() !== '') {
        const r = parsearLineasStream('\n', resto)
        for (const ev of r.eventos) {
          volcado.linea(JSON.stringify(ev))
          acumular(estado, ev)
          cola.push(ev)
        }
      }
      if (stderr.length) volcado.linea(JSON.stringify({ type: 'cs_stderr', texto: stderr.join('').slice(-4000) }))
      volcado.fin()
      cola.cerrar()
      o.signal?.removeEventListener('abort', onAbort)
      resolve({ ...estado, code })
    })
  })
  return { proceso, args, eventos: cola, salida }
}

function lanzarMock(o: OpcionesClaude, args: string[]): ProcesoClaude {
  const cola = new Cola<EventoStream>()
  const estado: SalidaClaude = { code: null }
  const volcado = abrirVolcado(o.volcarA)
  const delay = o.mockDelayMs ?? 150
  const lineas = fs.readFileSync(MOCK_STREAM, 'utf8').split('\n').filter((l) => l.trim() !== '')

  const salida = (async (): Promise<SalidaClaude> => {
    let abortado = false
    for (const linea of lineas) {
      if (o.signal?.aborted) {
        abortado = true
        break
      }
      await new Promise((r) => setTimeout(r, delay))
      const r = parsearLineasStream(linea + '\n')
      for (const ev of r.eventos) {
        volcado.linea(JSON.stringify(ev))
        acumular(estado, ev)
        cola.push(ev)
      }
    }
    volcado.fin()
    cola.cerrar()
    return { ...estado, code: abortado ? 143 : 0 }
  })()
  return { proceso: null, args, eventos: cola, salida }
}
