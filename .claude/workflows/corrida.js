export const meta = {
  name: 'corrida',
  description: 'Corrida de Competitor-Seeker: rastrea competidores en paralelo, consolida el análisis y lo verifica contra la evidencia hasta 3 intentos',
  whenToUse: 'Paso 4 de una corrida para UNA marca. args: { marca, fechaCorrida, ultimaCorrida, corridaId?, apify?: {habilitado, resultsLimit, motivo?}, competidores: [{nombre, url}] }. Devuelve { entradas, verificado, intentos, objeciones?, apify?, ig? }. El orquestador registra DESPUÉS con `scripts/cs registrar`; si verificado es false, no registra sin confirmación (o --pendiente en headless).',
  phases: [
    { title: 'Rastreo', detail: 'un rastreador-ig (todos los perfiles, secuencial) + un rastreador web por competidor + un rastreador-apify (si está habilitado), en paralelo' },
    { title: 'Análisis', detail: 'un analista consolida todos los hallazgos' },
    { title: 'Verificación', detail: 'un verificador refuta contra la evidencia; máx. 3 intentos' },
  ],
}

// El schema hace estructuralmente imposible una senal fuera del enum o una fecha no-ISO:
// si el analista devuelve algo inválido, se le fuerza a reintentar.
const ENTRADAS_SCHEMA = {
  type: 'object',
  properties: {
    entradas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          fecha: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          movimiento: { type: 'string' },
          senal: { enum: ['nuevo', 'confuso', 'sin-datos', 'no-funciona'] },
          lectura: { type: 'string' },
          fuentes: { type: 'array', items: { enum: ['ig', 'web', 'apify'] } },
          metricas: {
            type: 'object',
            properties: {
              likes: { type: 'integer' }, comentarios: { type: 'integer' },
              vistas: { type: 'integer' }, posts: { type: 'integer' },
            },
            additionalProperties: false,
          },
          evidencia: { type: 'array', items: { type: 'string' } },
        },
        required: ['marca', 'fecha', 'movimiento', 'senal', 'lectura'],
        additionalProperties: false,
      },
    },
  },
  required: ['entradas'],
}

const VEREDICTO_SCHEMA = {
  type: 'object',
  properties: {
    valido: { type: 'boolean' },
    objeciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          problema: { type: 'string' },
        },
        required: ['marca', 'problema'],
        additionalProperties: false,
      },
    },
  },
  required: ['valido', 'objeciones'],
}

const APIFY_SCHEMA = {
  type: 'object',
  properties: {
    hallazgos: { type: 'string' },
    resultados: { type: 'integer' },
    runId: { type: 'string' },
  },
  required: ['hallazgos', 'resultados'],
}

if (!args || !args.marca || !args.fechaCorrida || !Array.isArray(args.competidores) || args.competidores.length === 0) {
  throw new Error('args requeridos: { marca, fechaCorrida (ISO), ultimaCorrida (ISO o null), competidores: [{nombre, url}] }')
}

const apifyCfg = args.apify || { habilitado: false, motivo: 'no indicado por el orquestador' }

// Ventana de Apify: al menos los últimos 14 días aunque haya una corrida reciente. "Nuevo" se
// sigue juzgando contra ultimaCorrida (lo hace el analista), pero para medir rendimiento hacen
// falta posts con métricas. Corrida 2026-11-04 11:47: ultimaCorrida = mismo día → 0 posts.
const VENTANA_MIN_APIFY_DIAS = 14
function restarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d - dias))
  return f.toISOString().slice(0, 10)
}
const apifyDesdeMin = restarDias(args.fechaCorrida, VENTANA_MIN_APIFY_DIAS)
const apifyDesde = args.ultimaCorrida && args.ultimaCorrida < apifyDesdeMin ? args.ultimaCorrida : apifyDesdeMin
const corridaId = args.corridaId || `${args.fechaCorrida}-sin-id`

phase('Rastreo')
const periodo = args.ultimaCorrida
  ? `desde la última corrida (${args.ultimaCorrida})`
  : 'sin corrida previa (primera corrida: revisa el contenido reciente, últimas ~4 semanas)'

// Un solo agente de Instagram para TODOS los perfiles (hay un solo navegador:
// la sesión no se paraleliza); corre en paralelo con los rastreadores web.
const perfilesIG = args.competidores.filter(c => c.url && c.url.includes('instagram.com'))
const tareas = []

if (perfilesIG.length) {
  tareas.push(() =>
    agent(
      `Perfiles de Instagram a rastrear, EN ESTE ORDEN y uno por uno: ` +
      perfilesIG.map(c => `${c.nombre} → ${c.url}`).join('; ') + `. ` +
      `Periodo: ${periodo}, hasta hoy ${args.fechaCorrida}. ` +
      `Usa el navegador (sesión ya iniciada en el perfil dedicado). ` +
      `Devuelve un bloque de hallazgos crudos por perfil, según tu formato de salida.`,
      { label: 'rastreo-ig:todos', phase: 'Rastreo', agentType: 'rastreador-ig' }
    ).then(h => ({ nombre: 'INSTAGRAM', hallazgos: h }))
  )
}

// Rastreador Apify (métricas numéricas de IG): solo si el orquestador lo habilitó tras consultar el uso.
// `motivo` solo si es string y `runId` solo si existe: el schema de `cs registrar`
// (ResultadoWorkflow) no debe recibir `null` en campos opcionales.
let apifyInfo = { incluido: false, omitido: true, resultados: 0, costeEstimadoUsd: 0 }
if (typeof apifyCfg.motivo === 'string' && apifyCfg.motivo) apifyInfo.motivo = apifyCfg.motivo
if (perfilesIG.length && apifyCfg.habilitado) {
  const resultsLimit = apifyCfg.resultsLimit || 12
  tareas.push(() =>
    agent(
      `Perfiles de Instagram a consultar con Apify: ` +
      perfilesIG.map(c => `${c.nombre} → ${c.url}`).join('; ') + `. ` +
      `Periodo: ${periodo}, hasta hoy ${args.fechaCorrida}. ` +
      `resultsLimit por perfil: ${resultsLimit}. onlyPostsNewerThan: ${apifyDesde}. ` +
      `(Los posts anteriores a ${args.ultimaCorrida || 'la ventana'} sirven para medir rendimiento, no son movimientos nuevos.) ` +
      `Haz UNA sola llamada al actor con todos los perfiles y devuelve hallazgos crudos con METRICAS por post, según tu formato de salida.`,
      { label: 'rastreo-apify:todos', phase: 'Rastreo', agentType: 'rastreador-apify', schema: APIFY_SCHEMA }
    ).then(r => {
      apifyInfo = { incluido: true, omitido: false, resultados: r.resultados, costeEstimadoUsd: Math.round(r.resultados * 0.0027 * 10000) / 10000 }
      if (typeof r.runId === 'string' && r.runId) apifyInfo.runId = r.runId
      return { nombre: 'APIFY', hallazgos: r.hallazgos }
    })
  )
} else if (perfilesIG.length) {
  log(`Apify omitido: ${apifyCfg.motivo || 'deshabilitado'}`)
}

tareas.push(...args.competidores.map(c => () =>
  agent(
    `Competidor a investigar: ${c.nombre}${c.url ? ` (cuenta de referencia: ${c.url})` : ''}. ` +
    `Periodo: ${periodo}, hasta hoy ${args.fechaCorrida}. ` +
    `Rastreo web solamente (prensa, sitio, campañas) — Instagram lo cubre otro agente. ` +
    `Devuelve hallazgos crudos con evidencia y fuentes, según tu formato de salida.`,
    { label: `rastreo-web:${c.nombre}`, phase: 'Rastreo', agentType: 'rastreador' }
  ).then(h => ({ nombre: c.nombre, hallazgos: h }))
))

const rastreos = await parallel(tareas)

// Barrera justificada: el analista necesita los hallazgos de TODOS los rastreadores juntos.
const completos = rastreos.filter(Boolean)
const caidos = args.competidores
  .map(c => c.nombre)
  .filter(n => !completos.some(r => r.nombre === n))
if (caidos.length) log(`Rastreadores web sin respuesta: ${caidos.join(', ')} — irán como sin-datos`)

const igCaido = perfilesIG.length > 0 && !completos.some(r => r.nombre === 'INSTAGRAM')
if (igCaido) log('El rastreador de Instagram no respondió — la corrida sigue solo con rastreo web')

const bloqueIG = completos.find(r => r.nombre === 'INSTAGRAM')
const igSesion = igCaido ? 'error' : !bloqueIG ? 'no-usado' : /SESI[ÓO]N NO DISPONIBLE/i.test(bloqueIG.hallazgos) ? 'no-disponible' : 'ok'
if (igSesion === 'no-disponible') log('Instagram: SESIÓN NO DISPONIBLE — la corrida sigue con web' + (apifyInfo.incluido ? ' + Apify' : ''))

phase('Análisis')
const crudos = completos
  .map(r => `=== ${r.nombre} ===\n${r.hallazgos}`)
  .join('\n\n')

let notaCaidos = caidos.length
  ? `\n\nEstos competidores no pudieron rastrearse en la web (falla técnica del rastreador): ${caidos.join(', ')}. ` +
    `Genera para cada uno su entrada con senal "sin-datos" y movimiento indicando que el rastreo falló.`
  : ''
if (igCaido || igSesion === 'no-disponible') {
  notaCaidos += `\n\nEl rastreo de Instagram con navegador no pudo inspeccionar los perfiles (${igSesion === 'no-disponible' ? 'sesión no disponible' : 'falla técnica'}): ` +
    `al valorar los canales propios en Instagram, considera que no hubo inspección, no que no hubo actividad.`
}
if (apifyInfo.incluido) {
  notaCaidos += `\n\nEl bloque APIFY trae métricas numéricas (likes, comentarios, vistas, fechas) de los mismos perfiles: ` +
    `prevalecen sobre las cifras "visibles" del navegador. Si Apify y navegador discrepan de forma relevante, repórtalo como confuso. ` +
    `Marca las entradas sustentadas en Apify con fuentes: ["apify"] (o combinadas) y rellena metricas cuando tengas cifras.`
}

// Bucle acotado analista → verificador: el reintento corrige el análisis, nunca
// repite el rastreo (repetirlo no fabrica datos que no existen). Tope de 3 intentos
// para no presionar al analista a complacer al verificador inventando sustento.
const MAX_INTENTOS = 3
let resultado = null
let objeciones = []

for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
  const notaObjeciones = objeciones.length
    ? `\n\nTu intento anterior fue rechazado por el verificador. Corrige EXACTAMENTE estas objeciones ` +
      `(si la evidencia no alcanza, la corrección es bajar la señal a "confuso" o "sin-datos", no reforzar la afirmación):\n` +
      objeciones.map(o => `- [${o.marca}] ${o.problema}`).join('\n')
    : ''

  resultado = await agent(
    `Fecha de esta corrida: ${args.fechaCorrida}. Marca que vigila: ${args.marca}. ` +
    `Convierte los siguientes hallazgos crudos en entradas de log según soul.md y agent.md. ` +
    `Recuerda: todo competidor genera al menos una entrada.${notaCaidos}${notaObjeciones}\n\n${crudos}`,
    { label: `analista:intento-${intento}`, phase: 'Análisis', agentType: 'analista', schema: ENTRADAS_SCHEMA }
  )

  const veredicto = await agent(
    `Corrida del ${args.fechaCorrida} para la marca ${args.marca}. Competidores esperados: ` +
    `${args.competidores.map(c => c.nombre).join(', ')}.${notaCaidos}\n\n` +
    `HALLAZGOS CRUDOS DE LOS RASTREADORES:\n\n${crudos}\n\n` +
    `ENTRADAS PRODUCIDAS POR EL ANALISTA:\n\n${JSON.stringify(resultado.entradas, null, 2)}\n\n` +
    `Verifica las entradas contra los hallazgos según tu criterio de éxito y emite tu veredicto.`,
    { label: `verificacion:intento-${intento}`, phase: 'Verificación', agentType: 'verificador', schema: VEREDICTO_SCHEMA }
  )

  if (veredicto.valido) {
    log(`Verificación superada en el intento ${intento}`)
    return { corridaId, entradas: resultado.entradas, verificado: true, intentos: intento, objeciones: [], apify: apifyInfo, ig: { sesion: igSesion } }
  }
  objeciones = veredicto.objeciones
  log(`Intento ${intento} rechazado: ${objeciones.length} objeción(es)`)
}

// Tras agotar los intentos, se devuelve igual: el orquestador decide con el usuario
// si registrar o descartar, mostrando las objeciones pendientes.
return { corridaId, entradas: resultado.entradas, verificado: false, intentos: MAX_INTENTOS, objeciones, apify: apifyInfo, ig: { sesion: igSesion } }
