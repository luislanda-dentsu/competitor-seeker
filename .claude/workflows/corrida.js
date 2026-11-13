export const meta = {
  name: 'corrida',
  description: 'Corrida de Competitor-Seeker: rastrea competidores en paralelo, consolida el análisis y lo verifica contra la evidencia hasta 3 intentos',
  whenToUse: 'Paso 4 de una corrida para UNA marca. args: { marca, fechaCorrida, ultimaCorrida, corridaId?, apify?: {habilitado, resultsLimit, motivo?, topePosts?}, ventana?: {desde, hasta} (corrida histórica), competidores: [{nombre, url}] }. Devuelve { entradas, verificado, intentos, objeciones?, apify?, ig?, publicaciones, perfiles, lecturas }. El orquestador registra DESPUÉS con `scripts/cs registrar`; si verificado es false, no registra sin confirmación (o --pendiente en headless).',
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

// Datos estructurados de rendimiento: los devuelven los rastreadores de IG y Apify y el
// workflow los consolida SIN pasar por el analista (las cifras no se re-teclean).
const PUBLICACION_SCHEMA = {
  type: 'object',
  properties: {
    competidor: { type: 'string' },
    url: { type: 'string', pattern: '^https?://' },
    fecha: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    // Instante exacto (ISO con zona, p. ej. el datetime del <time> de IG o el timestamp de Apify).
    // Si viene, el workflow recalcula `fecha` en la zona horaria de la agencia.
    fechaHora: { type: 'string' },
    formato: { enum: ['reel', 'carrusel', 'imagen', 'video', 'otro'] },
    tema: { type: 'string', maxLength: 300 },
    likes: { type: 'integer', minimum: 0 },
    comentarios: { type: 'integer', minimum: 0 },
    vistas: { type: 'integer', minimum: 0 },
  },
  required: ['competidor', 'url', 'fecha', 'formato'],
  additionalProperties: false,
}

const PERFIL_SCHEMA = {
  type: 'object',
  properties: {
    competidor: { type: 'string' },
    seguidores: { type: 'integer', minimum: 0 },
    publicacionesTotales: { type: 'integer', minimum: 0 },
  },
  required: ['competidor'],
  additionalProperties: false,
}

const IG_SCHEMA = {
  type: 'object',
  properties: {
    hallazgos: { type: 'string' },
    publicaciones: { type: 'array', items: PUBLICACION_SCHEMA },
    perfiles: { type: 'array', items: PERFIL_SCHEMA },
    // Corrida histórica: URLs de los posts del grid que caen en la ventana (las enriquece Apify).
    urlsVentana: {
      type: 'array',
      items: {
        type: 'object',
        properties: { competidor: { type: 'string' }, url: { type: 'string', pattern: '^https?://' } },
        required: ['competidor', 'url'],
        additionalProperties: false,
      },
    },
  },
  required: ['hallazgos', 'publicaciones', 'perfiles'],
}

const LECTURAS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      competidor: { type: 'string', minLength: 1 },
      resumen: { type: 'array', items: { type: 'string', minLength: 1 }, maxItems: 6 },
      estrategia: {
        type: 'object',
        properties: {
          hipotesis: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
          pilares: { type: 'array', items: { type: 'string', minLength: 1 } },
          formatosYCadencia: { type: 'string', minLength: 1 },
          implicaciones: { type: 'array', items: { type: 'string', minLength: 1 } },
          confianza: { enum: ['alta', 'media', 'baja'] },
          postsCitados: { type: 'array', items: { type: 'string', minLength: 1 } },
        },
        required: ['hipotesis', 'pilares', 'formatosYCadencia', 'implicaciones', 'confianza', 'postsCitados'],
        additionalProperties: false,
      },
    },
    required: ['competidor', 'resumen'],
    additionalProperties: false,
  },
}
ENTRADAS_SCHEMA.properties.lecturas = LECTURAS_SCHEMA
ENTRADAS_SCHEMA.required.push('lecturas')

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
    publicaciones: { type: 'array', items: PUBLICACION_SCHEMA },
    perfiles: { type: 'array', items: PERFIL_SCHEMA },
  },
  required: ['hallazgos', 'resultados', 'publicaciones', 'perfiles'],
}

// --- Consolidación determinista de publicaciones y perfiles ---
// Decisión 2026-11-04 (corrida parval 16:18): las CIFRAS (likes, comentarios, vistas, seguidores)
// salen SOLO de Apify. El navegador las leía hasta 7× por debajo (likes de comentarios, contadores
// parciales): del navegador se conserva existencia, URL, fecha, formato y tema.
function clavePost(url) {
  const m = /instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([^/?#]+)/i.exec(url || '')
  return m ? `ig:${m[1]}` : String(url || '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase()
}
const CIFRAS = ['likes', 'comentarios', 'vistas']

// IG y Apify dan instantes en UTC: un post de las 21:27 del 3/11 en RD es "2026-11-04T01:27Z".
// La fecha que cuenta es la local (corrida 2026-11-04 16:03: United Capital marcado como del 4/11).
const ZONA = (args && args.zonaHoraria) || 'America/Santo_Domingo'
const fmtFechaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
function fechaLocalDe(instante) {
  if (typeof instante !== 'string' || !/T\d{2}:\d{2}/.test(instante)) return null
  const t = Date.parse(instante)
  return Number.isFinite(t) ? fmtFechaLocal.format(new Date(t)) : null
}
function normalizarFecha(p) {
  const { fechaHora, ...resto } = p
  const local = fechaLocalDe(fechaHora)
  return local ? { ...resto, fecha: local } : resto
}

function sinCifras(p) {
  const { likes, comentarios, vistas, ...resto } = p
  return resto
}
function consolidarPublicaciones(ig, apify) {
  const porClave = new Map()
  for (const [lista, fuente] of [[ig, 'ig'], [apify, 'apify']]) {
    for (let p of lista || []) {
      if (!p || !p.url || !p.competidor) continue
      p = normalizarFecha(p)
      if (fuente === 'ig') p = sinCifras(p)
      if (typeof p.tema === 'string') p = { ...p, tema: p.tema.slice(0, 300) }
      const k = clavePost(p.url)
      const previa = porClave.get(k)
      if (!previa) { porClave.set(k, { ...p, fuente }); continue }
      // Apify (segunda pasada) gana en cifras, fecha y formato; el texto del navegador se conserva si Apify no trae tema.
      const fusion = { ...previa, fuente: 'apify' }
      for (const c of [...CIFRAS, 'fecha', 'formato']) if (p[c] !== undefined) fusion[c] = p[c]
      if (p.tema) fusion.tema = p.tema
      fusion.url = p.url
      porClave.set(k, fusion)
    }
  }
  return [...porClave.values()].sort((a, b) => a.competidor.localeCompare(b.competidor) || b.fecha.localeCompare(a.fecha))
}
function consolidarPerfiles(_ig, apify) {
  // Seguidores y nº de publicaciones solo de Apify (el navegador da "41,4 mil").
  const porNombre = new Map()
  for (const [lista, fuente] of [[apify, 'apify']]) {
    for (const p of lista || []) {
      if (!p || !p.competidor) continue
      const previo = porNombre.get(p.competidor) || {}
      const nuevo = { ...previo, competidor: p.competidor }
      if (p.seguidores !== undefined) { nuevo.seguidores = p.seguidores; nuevo.fuente = fuente }
      if (p.publicacionesTotales !== undefined) nuevo.publicacionesTotales = p.publicacionesTotales
      if (!nuevo.fuente) nuevo.fuente = fuente
      porNombre.set(p.competidor, nuevo)
    }
  }
  return [...porNombre.values()]
}

if (!args || !args.marca || !args.fechaCorrida || !Array.isArray(args.competidores) || args.competidores.length === 0) {
  throw new Error('args requeridos: { marca, fechaCorrida (ISO), ultimaCorrida (ISO o null), competidores: [{nombre, url}] }')
}

const apifyCfg = args.apify || { habilitado: false, motivo: 'no indicado por el orquestador' }

// Corrida histórica (v2.3): mira SOLO una ventana pasada. Instagram (navegador) localiza los posts
// de la ventana y Apify se consulta únicamente con esas URLs (un resultado por URL, con tope),
// en vez de pagar todo lo publicado desde la ventana hasta hoy.
const ISO = /^\d{4}-\d{2}-\d{2}$/
const ventana = args.ventana && ISO.test(args.ventana.desde || '') && ISO.test(args.ventana.hasta || '') && args.ventana.desde <= args.ventana.hasta
  ? { desde: args.ventana.desde, hasta: args.ventana.hasta }
  : null
const historica = ventana !== null
const enVentana = f => !historica || (typeof f === 'string' && f >= ventana.desde && f <= ventana.hasta)

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
const periodoHistorico = historica
  ? `del ${ventana.desde} al ${ventana.hasta} (CORRIDA HISTÓRICA: solo esa ventana; lo anterior y lo posterior no interesa)`
  : null
const periodo = periodoHistorico || (args.ultimaCorrida
  ? `desde la última corrida (${args.ultimaCorrida})`
  : 'sin corrida previa (primera corrida: revisa el contenido reciente, últimas ~4 semanas)')
const hastaTexto = historica ? ventana.hasta : `hoy ${args.fechaCorrida}`

// Ventana de Instagram: desde la última corrida en la que IG se inspeccionó de verdad. Si las
// corridas posteriores no tuvieron sesión, sus posts nunca se vieron (corrida 2026-11-04 16:03:
// la de las 12:43 fue sin sesión y un post del 3/11 quedó fuera de "desde el 4/11").
const desdeIg = args.ultimaCorridaIg !== undefined ? args.ultimaCorridaIg : args.ultimaCorrida
const periodoIg = periodoHistorico || (desdeIg
  ? `desde la última corrida con Instagram inspeccionado (${desdeIg})`
  : 'sin corrida previa con Instagram inspeccionado (revisa las últimas ~4 semanas)')
const reglaNuevo = historica
  ? `CORRIDA HISTÓRICA de la ventana ${ventana.desde} → ${ventana.hasta} (fechas en hora local de ${ZONA}). ` +
    `Analiza lo que cada competidor hizo DENTRO de esa ventana: "nuevo" = movimiento publicado en la ventana. ` +
    `Cada entrada lleva la fecha real del movimiento, siempre entre ${ventana.desde} y ${ventana.hasta} ` +
    `(las de "sin-datos" llevan ${ventana.hasta}). Nada de fuera de la ventana. ` +
    `Las cifras de Apify son las de HOY (acumuladas desde la publicación), no las de entonces; no hay seguidores.`
  : `Criterio de "nuevo" (fechas en hora local de ${ZONA}): web/prensa → fecha ≥ ${args.ultimaCorrida || 'inicio de la ventana'}; ` +
    `Instagram → fecha ≥ ${desdeIg || 'inicio de la ventana (~4 semanas)'} (antes de esa fecha IG no se había inspeccionado). ` +
    `Lo anterior a esas fechas mide rendimiento, no es movimiento nuevo.`

// Un solo agente de Instagram para TODOS los perfiles (hay un solo navegador:
// la sesión no se paraleliza); corre en paralelo con los rastreadores web.
const perfilesIG = args.competidores.filter(c => c.url && c.url.includes('instagram.com'))
const tareas = []
let datosIG = null
let datosApify = null

if (perfilesIG.length) {
  tareas.push(() =>
    agent(
      `Perfiles de Instagram a rastrear, EN ESTE ORDEN y uno por uno: ` +
      perfilesIG.map(c => `${c.nombre} → ${c.url}`).join('; ') + `. ` +
      `Periodo: ${periodoIg}, hasta ${hastaTexto}. ` +
      (historica
        ? `MODO HISTÓRICO (sigue la sección "Modo histórico" de tus instrucciones): baja por el grid hasta la ventana, ` +
          `localiza sus límites abriendo pocos posts y devuelve en "urlsVentana" TODAS las URLs del grid que caen en la ventana ` +
          `(más los fijados y un post de margen a cada lado). No abras cada post: Apify traerá fecha, formato, texto y cifras. `
        : '') +
      `En cada publicación incluye "fechaHora" con el atributo datetime exacto del <time> (UTC); el workflow calcula la fecha local. ` +
      `Usa el navegador (sesión ya iniciada en el perfil dedicado). ` +
      `En publicaciones y perfiles usa como "competidor" EXACTAMENTE el nombre indicado antes de la flecha. ` +
      `Devuelve el JSON con hallazgos (un bloque por perfil), publicaciones y perfiles, según tu formato de salida.`,
      { label: 'rastreo-ig:todos', phase: 'Rastreo', agentType: 'rastreador-ig', schema: IG_SCHEMA }
    ).then(r => {
      datosIG = r
      return { nombre: 'INSTAGRAM', hallazgos: r.hallazgos }
    })
  )
}

// Rastreador Apify (métricas numéricas de IG): solo si el orquestador lo habilitó tras consultar el uso.
// `motivo` solo si es string y `runId` solo si existe: el schema de `cs registrar`
// (ResultadoWorkflow) no debe recibir `null` en campos opcionales.
let apifyInfo = { incluido: false, omitido: true, resultados: 0, costeEstimadoUsd: 0 }
if (typeof apifyCfg.motivo === 'string' && apifyCfg.motivo) apifyInfo.motivo = apifyCfg.motivo
function tareaApifyPerfiles() {
  const resultsLimit = apifyCfg.resultsLimit || 12
  return () =>
    agent(
      `Perfiles de Instagram a consultar con Apify: ` +
      perfilesIG.map(c => `${c.nombre} → ${c.url}`).join('; ') + `. ` +
      `Periodo: ${periodo}, hasta hoy ${args.fechaCorrida}. ` +
      `resultsLimit por perfil: ${resultsLimit}. onlyPostsNewerThan: ${apifyDesde}. ` +
      `(Los posts anteriores a ${args.ultimaCorrida || 'la ventana'} sirven para medir rendimiento, no son movimientos nuevos.) ` +
      `En publicaciones y perfiles usa como "competidor" EXACTAMENTE el nombre indicado antes de la flecha. ` +
      `Una llamada de posts y una de details (seguidores) con todos los perfiles; devuelve hallazgos, publicaciones (con "fechaHora" = timestamp del post) y perfiles según tu formato de salida.`,
      { label: 'rastreo-apify:todos', phase: 'Rastreo', agentType: 'rastreador-apify', schema: APIFY_SCHEMA }
    ).then(alRecibirApify)
}
function alRecibirApify(r) {
  datosApify = r
  apifyInfo = { incluido: true, omitido: false, resultados: r.resultados, costeEstimadoUsd: Math.round(r.resultados * 0.0027 * 10000) / 10000 }
  if (typeof r.runId === 'string' && r.runId) apifyInfo.runId = r.runId
  return { nombre: 'APIFY', hallazgos: r.hallazgos }
}
if (perfilesIG.length && apifyCfg.habilitado && !historica) {
  tareas.push(tareaApifyPerfiles())
} else if (perfilesIG.length && !apifyCfg.habilitado) {
  log(`Apify omitido: ${apifyCfg.motivo || 'deshabilitado'}`)
}

tareas.push(...args.competidores.map(c => () =>
  agent(
    `Competidor a investigar: ${c.nombre}${c.url ? ` (cuenta de referencia: ${c.url})` : ''}. ` +
    `Periodo: ${periodo}, hasta ${hastaTexto}. ` +
    `Rastreo web solamente (prensa, sitio, campañas) — Instagram lo cubre otro agente. ` +
    (historica ? `Busca lo publicado en esa ventana (archivo de prensa, notas fechadas); descarta lo de otras fechas. ` : '') +
    `Devuelve hallazgos crudos con evidencia y fuentes, según tu formato de salida.`,
    { label: `rastreo-web:${c.nombre}`, phase: 'Rastreo', agentType: 'rastreador' }
  ).then(h => ({ nombre: c.nombre, hallazgos: h }))
))

const rastreos = await parallel(tareas)

// Corrida histórica: Apify DESPUÉS de Instagram, solo con las URLs de la ventana y con tope.
if (historica && perfilesIG.length && apifyCfg.habilitado) {
  const tope = Number.isInteger(apifyCfg.topePosts) && apifyCfg.topePosts > 0 ? apifyCfg.topePosts : 0
  // URLs por competidor, sin duplicados y reconstruidas desde el código del post
  // (el grid da /<usuario>/p/<id>/; Apify espera https://www.instagram.com/p/<id>/).
  const porCompetidor = new Map(perfilesIG.map(c => [c.nombre, []]))
  const vistos = new Set()
  const candidatas = [
    ...((datosIG && datosIG.publicaciones) || []).map(normalizarFecha).filter(p => enVentana(p.fecha)),
    ...((datosIG && datosIG.urlsVentana) || []),
  ]
  for (const u of candidatas) {
    if (!u || !u.url || !porCompetidor.has(u.competidor)) continue
    const k = clavePost(u.url)
    if (!k.startsWith('ig:') || vistos.has(k)) continue
    vistos.add(k)
    porCompetidor.get(u.competidor).push({ competidor: u.competidor, url: `https://www.instagram.com/p/${k.slice(3)}/` })
  }
  // El tope se reparte por turnos: un competidor prolífico no deja a los demás sin cifras.
  const urls = []
  const listas = [...porCompetidor.values()]
  for (let i = 0; urls.length < tope && listas.some(l => i < l.length); i++) {
    for (const l of listas) if (i < l.length && urls.length < tope) urls.push(l[i])
  }
  const recortes = [...porCompetidor.entries()]
    .map(([nombre, l]) => [nombre, l.length, urls.filter(u => u.competidor === nombre).length])
    .filter(([, total, enviadas]) => enviadas < total)
  if (recortes.length) log(`Apify: tope de ${tope} URLs; recortados ${recortes.map(([n, t, e]) => `${n} ${e}/${t}`).join(', ')}`)
  const notaRecorte = recortes.length
    ? ` Tope de ${tope} URLs alcanzado: solo se consultaron ${recortes.map(([n, t, e]) => `${e} de ${t} de ${n}`).join(', ')}; los demás posts de la ventana quedan sin cifras.`
    : ''
  if (urls.length === 0) {
    const sinSesion = datosIG && /SESI[ÓO]N NO DISPONIBLE/i.test(datosIG.hallazgos || '')
    const motivo = tope === 0
      ? 'sin tope de posts confirmado'
      : !datosIG
        ? 'el rastreador de Instagram no respondió: sin URLs de la ventana'
        : sinSesion
          ? 'sesión de Instagram no disponible: sin URLs de la ventana'
          : 'el navegador no entregó URLs de la ventana'
    apifyInfo = { incluido: false, omitido: true, resultados: 0, costeEstimadoUsd: 0, motivo }
    log(`Apify omitido: ${apifyInfo.motivo}`)
  } else {
    const r = await agent(
      `MODO POSTS POR URL (corrida histórica, ventana ${ventana.desde} → ${ventana.hasta}). ` +
      `URLs de posts a consultar (${urls.length}): ${urls.map(u => u.url).join(' ')}. ` +
      `Perfiles (para traducir ownerUsername a competidor): ` + perfilesIG.map(c => `${c.nombre} → ${c.url}`).join('; ') + `. ` +
      `UNA sola llamada con directUrls = exactamente esas URLs, resultsType "posts", resultsLimit 1, sin onlyPostsNewerThan. ` +
      `NO hagas la llamada de details (no se necesitan seguidores). ` +
      `En publicaciones usa como "competidor" EXACTAMENTE el nombre indicado antes de la flecha; "perfiles": []. ` +
      `Devuelve hallazgos, resultados, runId y publicaciones (con "fechaHora" = timestamp del post) según tu formato de salida.`,
      { label: 'rastreo-apify:ventana', phase: 'Rastreo', agentType: 'rastreador-apify', schema: APIFY_SCHEMA }
    ).then(alRecibirApify).catch(e => { log(`Apify falló: ${e && e.message ? e.message : e}`); return null })
    if (r) rastreos.push({ ...r, hallazgos: r.hallazgos + notaRecorte })
  }
}

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
// En una histórica solo cuentan los posts de la ventana (Apify confirma la fecha de cada URL).
const publicaciones = consolidarPublicaciones(datosIG && datosIG.publicaciones, datosApify && datosApify.publicaciones)
  .filter(p => enVentana(p.fecha))
const perfiles = historica ? [] : consolidarPerfiles(datosIG && datosIG.perfiles, datosApify && datosApify.perfiles)
log(`Datos estructurados: ${publicaciones.length} publicaciones, ${perfiles.length} perfiles`)

// Recuentos calculados aquí para que el analista los copie, no los cuente (objeción 16:18: "8 → 9").
function recuentos() {
  return args.competidores.map(c => {
    const propios = publicaciones.filter(p => p.competidor === c.nombre)
    const nuevos = propios.filter(p => historica ? true : desdeIg ? p.fecha >= desdeIg : true)
    const porFormato = {}
    for (const p of propios) porFormato[p.formato] = (porFormato[p.formato] || 0) + 1
    const suma = k => propios.reduce((a, p) => a + (p[k] || 0), 0)
    const conCifras = propios.filter(p => p.likes !== undefined || p.comentarios !== undefined).length
    const desdeTexto = historica ? `la ventana ${ventana.desde} → ${ventana.hasta}` : desdeIg || 'el inicio de la ventana'
    return `- ${c.nombre}: ${propios.length} publicaciones en datos (${nuevos.length} en/desde ${desdeTexto}); ` +
      `formatos ${JSON.stringify(porFormato)}; con cifras de Apify ${conCifras}; likes ${suma('likes')}, comentarios ${suma('comentarios')}, vistas ${suma('vistas')}`
  }).join('\n')
}

const crudos = completos
  .map(r => `=== ${r.nombre} ===\n${r.hallazgos}`)
  .join('\n\n') +
  `\n\n=== DATOS ESTRUCTURADOS (IG + Apify consolidados; las cifras son SOLO de Apify) ===\n` +
  `RECUENTOS (calculados; cópialos, no recuentes):\n${recuentos()}\n` +
  `PUBLICACIONES:\n${JSON.stringify(publicaciones)}\nPERFILES:\n${JSON.stringify(perfiles)}`

let notaCaidos = caidos.length
  ? `\n\nEstos competidores no pudieron rastrearse en la web (falla técnica del rastreador): ${caidos.join(', ')}. ` +
    `Genera para cada uno su entrada con senal "sin-datos" y movimiento indicando que el rastreo falló.`
  : ''
if (igCaido || igSesion === 'no-disponible') {
  notaCaidos += `\n\nEl rastreo de Instagram con navegador no pudo inspeccionar los perfiles (${igSesion === 'no-disponible' ? 'sesión no disponible' : 'falla técnica'}): ` +
    `al valorar los canales propios en Instagram, considera que no hubo inspección, no que no hubo actividad.`
}
if (historica && apifyCfg.habilitado && !apifyInfo.incluido) {
  notaCaidos += `\n\nApify no se consultó (${apifyInfo.motivo || 'sin URLs'}): no hay cifras de esta ventana; no las inventes ni las estimes.`
}
if (apifyInfo.incluido) {
  notaCaidos += `\n\nEl bloque APIFY trae las métricas numéricas (likes, comentarios, vistas, seguidores): son las ÚNICAS cifras válidas. ` +
    `Ignora cualquier número del bloque INSTAGRAM (navegador): no es evidencia de cifras y su diferencia con Apify NO es una señal "confuso". ` +
    `Marca las entradas sustentadas en Apify con fuentes: ["apify"] (o combinadas) y rellena metricas cuando tengas cifras.`
}

// Saneado determinista de lo que el analista no debe decidir (corrida 2026-11-04 16:03):
// - `fuentes` solo puede citar canales que de verdad corrieron (marcó "apify" con Apify apagado
//   porque veía cifras en DATOS ESTRUCTURADOS, que venían del navegador).
// - `postsCitados` de una estrategia solo pueden ser posts del propio competidor.
const fuentesValidas = new Set(['web'])
if (igSesion === 'ok') fuentesValidas.add('ig')
if (apifyInfo.incluido && apifyInfo.resultados > 0) fuentesValidas.add('apify')
const clavesPorCompetidor = new Map()
for (const p of publicaciones) {
  if (!clavesPorCompetidor.has(p.competidor)) clavesPorCompetidor.set(p.competidor, new Set())
  clavesPorCompetidor.get(p.competidor).add(clavePost(p.url))
}
const clavesTodas = new Set(publicaciones.map(p => clavePost(p.url)))
function sanear(r) {
  const entradas = (r.entradas || []).map(e => {
    // Histórica: una entrada fuera de la ventana pasaría por el estado actual del competidor
    // (el semáforo toma la entrada más reciente). Se ancla al último día de la ventana.
    if (historica && !enVentana(e.fecha)) e = { ...e, fecha: ventana.hasta }
    if (!Array.isArray(e.fuentes)) return e
    const f = e.fuentes.filter(x => fuentesValidas.has(x))
    return { ...e, fuentes: f.length ? f : ['web'] }
  })
  const lecturas = (r.lecturas || []).map(l => {
    if (!l.estrategia) return l
    const propias = clavesPorCompetidor.get(l.competidor) || new Set()
    // Fuera: posts de OTRO competidor. Se conservan los propios y las URLs que no son posts conocidos.
    const citados = (l.estrategia.postsCitados || []).filter(u => propias.has(clavePost(u)) || !clavesTodas.has(clavePost(u)))
    return { ...l, estrategia: { ...l.estrategia, postsCitados: citados } }
  })
  return { ...r, entradas, lecturas }
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
    `Recuerda: todo competidor genera al menos una entrada. Además, en "lecturas", una por competidor: ` +
    `"resumen" (3–5 bullets de en qué consistieron sus publicaciones del periodo) y "estrategia" (qué parece estar haciendo ` +
    `estratégicamente, con hipótesis apoyadas en posts PROPIOS citados por URL); omite "estrategia" si no hay evidencia suficiente.\n` +
    `${reglaNuevo}\n` +
    `Canales que corrieron en esta corrida (el campo "fuentes" solo puede usar estos): ${[...fuentesValidas].join(', ')}. ` +
    `Las cifras de DATOS ESTRUCTURADOS llevan su "fuente": no etiquetes como apify lo que viene del navegador.` +
    `${notaCaidos}${notaObjeciones}\n\n${crudos}`,
    { label: `analista:intento-${intento}`, phase: 'Análisis', agentType: 'analista', schema: ENTRADAS_SCHEMA }
  ).then(sanear)

  const veredicto = await agent(
    `Corrida del ${args.fechaCorrida} para la marca ${args.marca}. Competidores esperados: ` +
    `${args.competidores.map(c => c.nombre).join(', ')}.${notaCaidos}\n${reglaNuevo}\n` +
    `Las fechas de DATOS ESTRUCTURADOS ya están en hora local (${ZONA}); no las reinterpretes desde UTC.\n\n` +
    `HALLAZGOS CRUDOS DE LOS RASTREADORES:\n\n${crudos}\n\n` +
    `ENTRADAS PRODUCIDAS POR EL ANALISTA:\n\n${JSON.stringify(resultado.entradas, null, 2)}\n\n` +
    `LECTURAS PRODUCIDAS POR EL ANALISTA:\n\n${JSON.stringify(resultado.lecturas || [], null, 2)}\n\n` +
    `Verifica las entradas contra los hallazgos según tu criterio de éxito y emite tu veredicto.`,
    { label: `verificacion:intento-${intento}`, phase: 'Verificación', agentType: 'verificador', schema: VEREDICTO_SCHEMA }
  )

  if (veredicto.valido) {
    log(`Verificación superada en el intento ${intento}`)
    return { corridaId, entradas: resultado.entradas, verificado: true, intentos: intento, objeciones: [], apify: apifyInfo, ig: { sesion: igSesion }, publicaciones, perfiles, lecturas: resultado.lecturas || [], ...(historica ? { ventana } : {}) }
  }
  objeciones = veredicto.objeciones
  log(`Intento ${intento} rechazado: ${objeciones.length} objeción(es)`)
}

// Tras agotar los intentos, se devuelve igual: el orquestador decide con el usuario
// si registrar o descartar, mostrando las objeciones pendientes.
return { corridaId, entradas: resultado.entradas, verificado: false, intentos: MAX_INTENTOS, objeciones, apify: apifyInfo, ig: { sesion: igSesion }, publicaciones, perfiles, lecturas: resultado.lecturas || [], ...(historica ? { ventana } : {}) }
