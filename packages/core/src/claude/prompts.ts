// Prompts que el runner pasa a `claude -p` y la lista de tools permitidas.

export interface ApifyPrompt {
  habilitado: boolean
  resultsLimit: number
  motivo?: string
}

export interface DatosPromptCorrida {
  marca: string
  fechaCorrida: string
  ultimaCorrida: string | null
  corridaId: string
  apify: ApifyPrompt
}

// Verificado (Fase 3, Claude Code 2.1.317): en `--permission-mode dontAsk` la
// sintaxis `Bash(<prefijo> *)` con espacio se respeta y Bash NO se deniega
// (`permission_denials: []`). Ver docs/spike-claude-p.md → "Bash en headless".
export const allowedToolsCorrida: readonly string[] = [
  'Workflow',
  'Agent',
  'Read',
  'Grep',
  'Glob',
  'WebSearch',
  'WebFetch',
  'mcp__claude-in-chrome__*',
  'mcp__apify__*',
  'Bash(scripts/cs *)',
  'Bash(./scripts/cs *)',
]

/** `--json-schema` del JSON final que devuelve el orquestador en una corrida headless. */
export const esquemaSalidaCorrida: Record<string, unknown> = {
  type: 'object',
  properties: {
    corridaId: { type: 'string' },
    estado: { type: 'string' },
    verificado: { type: 'boolean' },
    intentos: { type: 'integer' },
    entradas: { type: 'integer' },
    igSesion: { type: 'string' },
  },
  required: ['corridaId', 'estado', 'verificado', 'intentos', 'entradas'],
}

export function promptCorrida(d: DatosPromptCorrida): string {
  const estadoApify = d.apify.habilitado
    ? `Apify HABILITADO (resultsLimit ${d.apify.resultsLimit} por perfil).`
    : `Apify DESHABILITADO${d.apify.motivo ? ` (${d.apify.motivo})` : ''}: no lances el rastreador-apify.`
  return [
    `Ejecuta una corrida de Competitor-Seeker para la marca "${d.marca}".`,
    `Fecha de la corrida: ${d.fechaCorrida}. Última corrida registrada: ${d.ultimaCorrida ?? 'ninguna (primera corrida)'}. corridaId: ${d.corridaId}.`,
    estadoApify,
    '',
    'MODO HEADLESS: nadie puede responder preguntas; no uses AskUserQuestion ni esperes confirmación.',
    `Sigue el grafo de CLAUDE.md lanzando el workflow .claude/workflows/corrida.js por scriptPath con args ` +
      `{ marca, fechaCorrida, ultimaCorrida, corridaId: "${d.corridaId}", apify: ${JSON.stringify(d.apify)}, competidores }.`,
    `Registra SIEMPRE con \`scripts/cs registrar --marca ${d.marca} --corrida-id ${d.corridaId} --modo ui <<< '<JSON del workflow>'\` ` +
      '(here-string en UNA sola línea, con el JSON compacto entre comillas simples; los heredoc multilínea `<<EOF` se deniegan en headless); ' +
      'nunca escribas log.jsonl ni corridas/*.json a mano.',
    'Si el verificador rechaza 3 veces, registra igual con `--pendiente` y termina: la persona decidirá en la UI.',
    'Si Instagram reporta SESIÓN NO DISPONIBLE (Chrome cerrado, extensión desconectada o IG deslogueado) sigue con web (+Apify) y anótalo en `ig.sesion`.',
    'La cuenta de Instagram es solo lectura: nada de likes, follows ni comentarios.',
    'Al terminar devuelve solo el JSON final: { corridaId, estado, verificado, intentos, entradas: <n>, igSesion }.',
  ].join('\n')
}

export interface DatosPromptAsistente {
  marca: string
  contexto: string
  pregunta: string
}

/** Tools del asistente: solo lectura. El agente `asistente.md` ya las limita; el runner lo refuerza. */
export const allowedToolsAsistente: readonly string[] = ['Read', 'Grep']

export const disallowedToolsAsistente: readonly string[] = [
  'Write',
  'Edit',
  'Bash',
  'Workflow',
  'Agent',
  'WebSearch',
  'WebFetch',
  'mcp__claude-in-chrome__*',
  'mcp__apify__*',
]

export const MARCADOR_ARTEFACTO = 'artifact:entradas'

/** Instrucciones de formato que el panel espera (bloque de artefacto + regla de evidencia). */
export function instruccionesAsistente(marca: string): string {
  return [
    `Eres el asistente de inteligencia competitiva de la marca "${marca}" en el panel de Competitor-Seeker.`,
    'Responde SOLO con lo que está en el contexto (marca, corridas, soul.md y entradas del log). El contexto ya es la fuente completa: no necesitas abrir archivos salvo que la pregunta exija un detalle que no esté aquí.',
    'Sin evidencia → dilo. Si el log no registra nada sobre lo que preguntan, responde literalmente que no hay evidencia registrada sobre X e indica la fecha de la última corrida. Nunca inventes movimientos, cifras ni fechas.',
    'Una entrada `sin-datos` o `no-funciona` NO prueba que el competidor esté inactivo: ausencia de data no es ausencia de actividad. Distingue siempre lo observado (movimiento) de la interpretación (lectura).',
    'No lances corridas, no navegues ni busques en la web, no escribas archivos. Si te lo piden, explica que eso se hace desde la pestaña Corridas.',
    'Tono analítico y frío, en español, sin adjetivos de más. Respuestas cortas; listas cuando ayuden. Markdown simple (párrafos, listas, **negritas**); sin tablas ni cabeceras.',
    '',
    'FORMATO DE ARTEFACTO. Cuando cites entradas concretas del log, termina la respuesta con UN solo bloque exactamente así (el panel lo convierte en una tabla y lo oculta del texto):',
    '```' + MARCADOR_ARTEFACTO,
    '{"titulo": "<título corto de la selección>", "ids": ["<id exacto de entrada>", "..."]}',
    '```',
    'Usa únicamente los `id` que aparecen en el contexto (16 hex). Si no citas entradas, no emitas el bloque. Nada después del bloque.',
  ].join('\n')
}

export function promptAsistente(d: DatosPromptAsistente): string {
  return [
    instruccionesAsistente(d.marca),
    '',
    '=== CONTEXTO ===',
    d.contexto,
    '=== FIN CONTEXTO ===',
    '',
    `Pregunta: ${d.pregunta}`,
  ].join('\n')
}
