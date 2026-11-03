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

export function promptAsistente(d: DatosPromptAsistente): string {
  return [
    `Eres el asistente de inteligencia competitiva de la marca "${d.marca}".`,
    'Responde solo con lo que está en el contexto (log, corridas, marca y soul.md). Si no hay evidencia, dilo explícitamente.',
    'No lances corridas, no navegues ni busques en la web. Tono analítico y frío, en español.',
    'Cuando cites entradas concretas, añade al final un bloque ```artifact:entradas con {"titulo": "...", "ids": [...]}.',
    '',
    '=== CONTEXTO ===',
    d.contexto,
    '=== FIN CONTEXTO ===',
    '',
    `Pregunta: ${d.pregunta}`,
  ].join('\n')
}
