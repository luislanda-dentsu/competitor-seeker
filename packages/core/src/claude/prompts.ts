// Prompts que el runner pasa a `claude -p` y la lista de tools permitidas.

export interface ApifyPrompt {
  habilitado: boolean
  resultsLimit: number
  motivo?: string
  /** Corrida histórica: máximo de URLs de posts que se mandan a Apify (confirmado por la usuaria). */
  topePosts?: number
}

export interface DatosPromptCorrida {
  marca: string
  fechaCorrida: string
  ultimaCorrida: string | null
  /** Última corrida registrada con Instagram inspeccionado (`ig.sesion: ok`). */
  ultimaCorridaIg?: string | null
  corridaId: string
  apify: ApifyPrompt
  /** Corrida histórica: ventana pasada a rastrear (fechas locales inclusivas). */
  ventana?: { desde: string; hasta: string }
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
  'mcp__chrome-devtools__*',
  'mcp__apify__*',
  'Bash(scripts/cs *)',
  'Bash(./scripts/cs *)',
]

/**
 * Tools que en headless dejan el proceso vivo tras terminar (despertadores, monitores,
 * crons) o que no tienen sentido sin usuaria. Corrida del 2026-11-04: el orquestador
 * programó un ScheduleWakeup de 30 min mientras esperaba al workflow y el proceso
 * siguió vivo 17 min después de registrar.
 */
export const disallowedToolsCorrida: readonly string[] = [
  'ScheduleWakeup',
  'Monitor',
  'CronCreate',
  'CronDelete',
  'RemoteTrigger',
  'PushNotification',
  'AskUserQuestion',
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
  const historica = d.ventana
    ? [
        `CORRIDA HISTÓRICA: rastrea SOLO la ventana del ${d.ventana.desde} al ${d.ventana.hasta} (no lo reciente). ` +
          `Pasa \`ventana: ${JSON.stringify(d.ventana)}\` en los args del workflow; el workflow se encarga del resto ` +
          `(Instagram localiza los posts de la ventana y Apify se consulta solo con esas URLs, hasta ${d.apify.topePosts ?? 0}).`,
      ]
    : []
  return [
    `Ejecuta una corrida de Competitor-Seeker para la marca "${d.marca}".`,
    ...historica,
    `Fecha de la corrida: ${d.fechaCorrida}. Última corrida registrada: ${d.ultimaCorrida ?? 'ninguna (primera corrida)'}. ` +
      `Última corrida con Instagram inspeccionado: ${d.ultimaCorridaIg ?? 'ninguna'}. corridaId: ${d.corridaId}.`,
    estadoApify,
    '',
    'MODO HEADLESS: nadie puede responder preguntas; no uses AskUserQuestion ni esperes confirmación.',
    'El Workflow corre en segundo plano y te notifica al terminar: espera esa notificación sin programar despertadores ni monitores, y termina en cuanto registres y devuelvas el JSON.',
    `Sigue el grafo de CLAUDE.md lanzando el workflow .claude/workflows/corrida.js por scriptPath con args ` +
      `{ marca, fechaCorrida, ultimaCorrida, ultimaCorridaIg: ${JSON.stringify(d.ultimaCorridaIg ?? null)}, corridaId: "${d.corridaId}", apify: ${JSON.stringify(d.apify)}, ` +
      `${d.ventana ? `ventana: ${JSON.stringify(d.ventana)}, ` : ''}competidores }.`,
    `La decisión de Apify ya está tomada (${d.apify.habilitado ? 'habilitado' : 'omitido'}${d.apify.motivo ? `, motivo: ${d.apify.motivo}` : ''}): ` +
      'no la re-decidas; no consultes `scripts/cs apify-uso` ni cambies `apify.habilitado` al pasarlo al workflow.',
    `Registra SIEMPRE con \`scripts/cs registrar --marca ${d.marca} --corrida-id ${d.corridaId} --modo ui --desde-workflow <ruta>\` ` +
      '(añade --pendiente si verificado es false), donde <ruta> es el archivo de salida del Workflow que aparece en su notificación de fin ' +
      '(output_file / .output). No copies el JSON en la línea de comando ni uses here-strings: el filtro de permisos los rechaza con JSON largo. ',
      'Nunca escribas log.jsonl ni corridas/*.json a mano.',
    'Si el verificador rechaza 3 veces, registra igual con `--pendiente` y termina: la persona decidirá en la UI.',
    'Si Instagram reporta SESIÓN NO DISPONIBLE (perfil dedicado abierto/bloqueado, MCP chrome-devtools caído o IG deslogueado) sigue con web (+Apify) y anótalo en `ig.sesion`.',
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
  'mcp__chrome-devtools__*',
  'mcp__apify__*',
  // El log viene de scraping: un texto inyectado no debe poder hacer leer secretos ni estado local.
  'Read(./.env*)',
  'Read(./data/**)',
  'Grep(./data/**)',
  'Read(./.claude/settings*)',
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
