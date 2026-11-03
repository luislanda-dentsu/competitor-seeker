// Parseo del `--output-format stream-json` de `claude -p` y su resumen a
// eventos de consola para la UI.
import path from 'node:path'

/** Evento crudo del stream: siempre un objeto con `type`. */
export interface EventoStream {
  type: string
  subtype?: string
  [clave: string]: unknown
}

export type TipoEventoCorrida = 'fase' | 'agente' | 'texto' | 'tool' | 'denegado' | 'fin' | 'info'

export interface EventoCorrida {
  /** Epoch ms en que se resumió el evento. */
  ts: number
  tipo: TipoEventoCorrida
  fase?: string
  etiqueta?: string
  texto: string
  extra?: Record<string, unknown>
}

export interface LineasParseadas {
  eventos: EventoStream[]
  /** Fragmento final sin `\n`, a concatenar con el siguiente chunk. */
  resto: string
  /** Líneas completas que no eran JSON válido (p. ej. ruido en stdout). */
  descartadas: string[]
}

/** Reensambla líneas partidas entre chunks y parsea cada línea completa. */
export function parsearLineasStream(chunk: string, resto: string = ''): LineasParseadas {
  const texto = resto + chunk
  const partes = texto.split('\n')
  const nuevoResto = partes.pop() ?? ''
  const eventos: EventoStream[] = []
  const descartadas: string[] = []
  for (const linea of partes) {
    const limpia = linea.replace(/\r$/, '')
    if (limpia.trim() === '') continue
    const ev = parsearEvento(limpia)
    if (ev) eventos.push(ev)
    else descartadas.push(limpia)
  }
  return { eventos, resto: nuevoResto, descartadas }
}

export function parsearEvento(linea: string): EventoStream | null {
  try {
    const v = JSON.parse(linea) as unknown
    if (v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string') return v as EventoStream
    return null
  } catch {
    return null
  }
}

interface BloqueContenido {
  type: string
  text?: string
  name?: string
  input?: Record<string, unknown>
}

function bloques(ev: EventoStream): BloqueContenido[] {
  const msg = ev.message as { content?: unknown } | undefined
  return Array.isArray(msg?.content) ? (msg.content as BloqueContenido[]) : []
}

function etiquetaTool(b: BloqueContenido): string {
  const input = b.input ?? {}
  switch (b.name) {
    case 'Workflow': {
      const script = typeof input.scriptPath === 'string' ? path.basename(input.scriptPath, path.extname(input.scriptPath)) : undefined
      const nombre = typeof input.name === 'string' ? input.name : undefined
      return `▶ Workflow ${script ?? nombre ?? ''}`.trim()
    }
    case 'Agent': {
      const tipo = typeof input.subagent_type === 'string' ? input.subagent_type : ''
      const desc = typeof input.description === 'string' ? input.description : ''
      return `▶ Agent ${tipo}${desc ? ` · ${desc}` : ''}`.trim()
    }
    case 'Bash': {
      const cmd = typeof input.command === 'string' ? input.command.split('\n')[0] ?? '' : ''
      return `▶ Bash ${cmd.slice(0, 80)}`.trim()
    }
    default:
      return `▶ ${b.name ?? 'tool'}`
  }
}

/** Resume un evento crudo a uno de consola, o null si no aporta nada visible. */
export function resumirEvento(ev: EventoStream, ts: number = Date.now()): EventoCorrida | null {
  return resumirEventos(ev, ts)[0] ?? null
}

/** Igual que `resumirEvento` pero devuelve todos los eventos de un mensaje con varios bloques. */
export function resumirEventos(ev: EventoStream, ts: number = Date.now()): EventoCorrida[] {
  switch (ev.type) {
    case 'system':
      return resumirSistema(ev, ts)
    case 'assistant':
      return resumirAsistente(ev, ts)
    case 'stream_event': {
      const evento = ev.event as { type?: string; delta?: { type?: string; text?: string } } | undefined
      if (evento?.type === 'content_block_delta' && evento.delta?.type === 'text_delta' && evento.delta.text) {
        return [{ ts, tipo: 'texto', texto: evento.delta.text }]
      }
      return []
    }
    case 'result': {
      const texto = typeof ev.result === 'string' ? ev.result : ''
      return [
        {
          ts,
          tipo: 'fin',
          texto,
          extra: {
            structured_output: ev.structured_output,
            duration_api_ms: ev.duration_api_ms,
            session_id: ev.session_id,
            is_error: ev.is_error,
            subtype: ev.subtype,
            total_cost_usd: ev.total_cost_usd,
          },
        },
      ]
    }
    default:
      return []
  }
}

function resumirSistema(ev: EventoStream, ts: number): EventoCorrida[] {
  switch (ev.subtype) {
    case 'task_progress': {
      const descripcion = typeof ev.description === 'string' ? ev.description : ''
      const sep = descripcion.indexOf(':')
      const fase = sep >= 0 ? descripcion.slice(0, sep).trim() : descripcion.trim()
      const etiqueta = sep >= 0 ? descripcion.slice(sep + 1).trim() : undefined
      return [{ ts, tipo: 'fase', fase, ...(etiqueta ? { etiqueta } : {}), texto: descripcion }]
    }
    case 'task_started': {
      const nombre = typeof ev.workflow_name === 'string' ? ev.workflow_name : (ev.task_type as string | undefined) ?? 'tarea'
      return [{ ts, tipo: 'info', texto: `Iniciado: ${nombre}` }]
    }
    case 'task_notification': {
      const resumen = typeof ev.summary === 'string' ? ev.summary : `Tarea ${ev.status ?? ''}`.trim()
      return [{ ts, tipo: 'info', texto: resumen, extra: { status: ev.status } }]
    }
    case 'permission_denied': {
      const tool = typeof ev.tool_name === 'string' ? ev.tool_name : 'desconocida'
      return [{ ts, tipo: 'denegado', etiqueta: tool, texto: `Permiso denegado: ${tool}` }]
    }
    case 'init': {
      const modelo = typeof ev.model === 'string' ? ev.model : ''
      return [{ ts, tipo: 'info', texto: `Sesión iniciada${modelo ? ` · ${modelo}` : ''}`, extra: { session_id: ev.session_id } }]
    }
    default:
      return []
  }
}

function resumirAsistente(ev: EventoStream, ts: number): EventoCorrida[] {
  const salida: EventoCorrida[] = []
  const deSubagente = typeof ev.parent_tool_use_id === 'string' && ev.parent_tool_use_id !== ''
  for (const b of bloques(ev)) {
    if (b.type === 'tool_use') salida.push({ ts, tipo: 'tool', etiqueta: b.name, texto: etiquetaTool(b) })
    // El texto del asistente principal ya llegó como deltas; el de subagentes no.
    else if (b.type === 'text' && deSubagente && b.text) {
      salida.push({ ts, tipo: 'agente', etiqueta: ev.parent_tool_use_id as string, texto: b.text })
    }
  }
  return salida
}
