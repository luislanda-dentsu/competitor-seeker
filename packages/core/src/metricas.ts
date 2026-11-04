// Métricas de rendimiento de contenido por competidor (puras, sin I/O).
// Fuente principal: `publicaciones` / `perfiles` / `lecturas` de cada corrida (v2.1).
// Corridas anteriores sin `publicaciones` aportan solo totales desde `Entrada.metricas`
// (cobertura "parcial"). Nada se estima: sin seguidores, el ER es null.
import { fechaLocal } from './corridas.ts'
import type { Corrida } from './schemas/corrida.ts'
import { clavePublicacion, type EstrategiaCompetidor, type FormatoPost, type Publicacion } from './schemas/publicacion.ts'

/** Rango inclusivo de fechas ISO; `null` = abierto. */
export interface Periodo {
  desde: string | null
  hasta: string | null
}

export const PERIODO_TODO: Periodo = { desde: null, hasta: null }

export function enPeriodo(fecha: string, p: Periodo): boolean {
  return (p.desde === null || fecha >= p.desde) && (p.hasta === null || fecha <= p.hasta)
}

export interface PostConEr extends Publicacion {
  /** Corrida más reciente que observó el post (sus cifras son las vigentes). */
  corrida: string
  /** (likes + comentarios) / seguidores × 100; null sin seguidores o sin cifras. */
  er: number | null
}

export interface Cifra {
  total: number
  /** Promedio por post; null si ningún post con el dato tiene recuento conocido. */
  promedio: number | null
  /** Posts que aportan el dato al promedio. */
  n: number
}

export interface PuntoSerieCompetidor {
  corrida: string
  fecha: string
  seguidores: number | null
  posts: number
  erPromedio: number | null
}

export interface LecturaFechada {
  corrida: string
  fecha: string
  resumen: string[]
  estrategia?: EstrategiaCompetidor
}

export type Cobertura = 'completa' | 'parcial' | 'sin-datos'

export interface MetricasCompetidor {
  competidor: string
  /** Posts del periodo (por fecha del post), deduplicados entre corridas, más reciente primero. */
  publicaciones: PostConEr[]
  posts: number
  /** Posts por semana en el periodo; null si el periodo no tiene duración conocida. */
  cadenciaSemanal: number | null
  likes: Cifra
  comentarios: Cifra
  vistas: Cifra & { mediana: number | null }
  er: { promedio: number | null; porFormato: Partial<Record<FormatoPost, { posts: number; erPromedio: number | null }>> }
  formatos: Partial<Record<FormatoPost, number>>
  seguidores: { actual: number | null; delta: number | null }
  top: PostConEr[]
  cobertura: Cobertura
  /** Posts con al menos una cifra (likes/comentarios/vistas) sobre el total. */
  conCifras: number
  serie: PuntoSerieCompetidor[]
  /** Lecturas de las corridas del periodo, más reciente primero. */
  lecturas: LecturaFechada[]
}

const DIA_MS = 86_400_000

function registradasAsc(corridas: readonly Corrida[]): Corrida[] {
  return corridas
    .filter((c) => c.estado === 'registrada')
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio))
}

const redondear = (n: number, dec = 2): number => Math.round(n * 10 ** dec) / 10 ** dec

function promedio(xs: readonly number[]): number | null {
  return xs.length ? redondear(xs.reduce((a, b) => a + b, 0) / xs.length) : null
}

function mediana(xs: readonly number[]): number | null {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2
}

function seguidoresEn(c: Corrida, competidor: string): number | null {
  return c.perfiles?.find((p) => p.competidor === competidor)?.seguidores ?? null
}

function fuenteSeguidores(c: Corrida, competidor: string): string | null {
  return c.perfiles?.find((p) => p.competidor === competidor)?.fuente ?? null
}

/** Ventana de rastreo por defecto de una primera corrida (sin ultimaCorrida). */
const DIAS_PRIMERA_CORRIDA = 28

function restarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10)
}

/** Seguidores de la corrida indicada o, si no los tiene, del snapshot más cercano en fecha. */
function seguidoresCercanos(corridas: readonly Corrida[], competidor: string, corridaId: string): number | null {
  const base = corridas.find((c) => c.id === corridaId)
  const propia = base ? seguidoresEn(base, competidor) : null
  if (propia !== null || !base) return propia
  const t = Date.parse(base.fecha)
  let mejor: { d: number; s: number } | null = null
  for (const c of corridas) {
    const s = seguidoresEn(c, competidor)
    if (s === null) continue
    const d = Math.abs(Date.parse(c.fecha) - t)
    if (!mejor || d < mejor.d) mejor = { d, s }
  }
  return mejor?.s ?? null
}

export function erDe(p: Pick<Publicacion, 'likes' | 'comentarios'>, seguidores: number | null): number | null {
  if (!seguidores || (p.likes === undefined && p.comentarios === undefined)) return null
  return redondear((((p.likes ?? 0) + (p.comentarios ?? 0)) / seguidores) * 100)
}

/**
 * `valores`: cifras por post. `legado`: totales de entradas antiguas; solo las que traen
 * `posts` entran en el promedio (un total sin recuento de posts no se puede promediar).
 */
function cifra(valores: readonly number[], legado: readonly { total: number; posts?: number }[]): Cifra {
  const sumaPosts = valores.reduce((a, b) => a + b, 0)
  const total = sumaPosts + legado.reduce((a, l) => a + l.total, 0)
  const conPosts = legado.filter((l) => l.posts !== undefined && l.posts > 0)
  const n = valores.length + conPosts.reduce((a, l) => a + l.posts!, 0)
  const base = sumaPosts + conPosts.reduce((a, l) => a + l.total, 0)
  return { total, promedio: n ? redondear(base / n, 1) : null, n }
}

/**
 * Días observados del periodo: empieza en el más tardío entre `p.desde` y el inicio de la
 * cobertura (lo que rastreó la primera corrida), para no diluir la cadencia en días sin datos.
 */
function diasPeriodo(p: Periodo, posts: readonly PostConEr[], hoy: string, coberturaDesde: string | null): number | null {
  const fin = p.hasta ?? hoy
  const candidatos = [p.desde, coberturaDesde].filter((x): x is string => x !== null)
  const inicio = candidatos.length ? candidatos.sort().at(-1)! : posts.at(-1)?.fecha ?? null
  if (!inicio || inicio > fin) return null
  return Math.max(1, Math.round((Date.parse(fin) - Date.parse(inicio)) / DIA_MS) + 1)
}

export interface OpcionesMetricas {
  periodo?: Periodo
  /** Fecha ISO de "hoy" para periodos abiertos (tests). */
  hoy?: string
}

export function metricasCompetidor(
  corridasTodas: readonly Corrida[],
  competidor: string,
  o: OpcionesMetricas = {},
): MetricasCompetidor {
  const periodo = o.periodo ?? PERIODO_TODO
  const hoy = o.hoy ?? fechaLocal(new Date())
  const corridas = registradasAsc(corridasTodas)

  // 1. Posts deduplicados campo a campo: una corrida posterior actualiza las cifras que trae,
  //    pero no borra las que solo tenía una anterior (p. ej. Apify antes, solo navegador después).
  const porClave = new Map<string, PostConEr>()
  for (const c of corridas) {
    for (const p of c.publicaciones ?? []) {
      if (p.competidor !== competidor) continue
      const k = clavePublicacion(p.url)
      const previa = porClave.get(k)
      const definidos = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as Publicacion
      const traeCifras = p.likes !== undefined || p.comentarios !== undefined || p.vistas !== undefined
      porClave.set(k, {
        ...(previa ?? {}),
        ...definidos,
        corrida: !previa || traeCifras ? c.id : previa.corrida,
        er: null,
      })
    }
  }
  const publicaciones = [...porClave.values()]
    .filter((p) => enPeriodo(p.fecha, periodo))
    .map((p) => ({ ...p, er: erDe(p, seguidoresCercanos(corridas, competidor, p.corrida)) }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  // 2. Fallback: corridas sin `publicaciones` aportan totales de Entrada.metricas del periodo.
  //    Solo la corrida antigua más reciente con cifras (sus ventanas se solapan entre corridas)
  //    y solo entradas agregadas con recuento de posts (las demás duplican posts sueltos).
  const legadoPorCorrida = corridas
    .filter((c) => c.publicaciones === undefined)
    .map((c) =>
      c.entradas
        .filter((e) => e.marca === competidor && e.metricas?.posts !== undefined && enPeriodo(e.fecha, periodo))
        .map((e) => e.metricas!),
    )
    .filter((xs) => xs.length > 0)
  const legado = legadoPorCorrida.at(-1) ?? []
  const sumar = (k: 'posts') => legado.reduce((a, m) => a + (m[k] ?? 0), 0)
  const delLegado = (k: 'likes' | 'comentarios' | 'vistas') =>
    legado.flatMap((m) => (m[k] === undefined ? [] : [{ total: m[k]!, ...(m.posts !== undefined ? { posts: m.posts } : {}) }]))

  const valores = (k: 'likes' | 'comentarios' | 'vistas') =>
    publicaciones.flatMap((p) => (p[k] === undefined ? [] : [p[k]!]))

  const posts = publicaciones.length + sumar('posts')
  const ers = publicaciones.flatMap((p) => (p.er === null ? [] : [p.er]))

  const formatos: MetricasCompetidor['formatos'] = {}
  const porFormato: MetricasCompetidor['er']['porFormato'] = {}
  for (const p of publicaciones) {
    formatos[p.formato] = (formatos[p.formato] ?? 0) + 1
  }
  for (const f of Object.keys(formatos) as FormatoPost[]) {
    const delFormato = publicaciones.filter((p) => p.formato === f)
    porFormato[f] = { posts: delFormato.length, erPromedio: promedio(delFormato.flatMap((p) => (p.er === null ? [] : [p.er]))) }
  }

  // 3. Seguidores: último snapshot del periodo vs. el último anterior (o el primero del periodo).
  const snaps = corridas
    .map((c) => ({ c, s: seguidoresEn(c, competidor) }))
    .filter((x): x is { c: Corrida; s: number } => x.s !== null)
  const enRango = snaps.filter((x) => enPeriodo(x.c.fecha, periodo))
  const ultimo = enRango.at(-1)
  const actual = ultimo?.s ?? null
  // El delta solo compara snapshots de la misma fuente (IG redondea "12,3 mil"; Apify es exacto).
  const fuente = ultimo ? fuenteSeguidores(ultimo.c, competidor) : null
  const misma = snaps.filter((x) => fuenteSeguidores(x.c, competidor) === fuente)
  const antes = misma.filter((x) => periodo.desde !== null && x.c.fecha < periodo.desde).at(-1)
  const enRangoMisma = misma.filter((x) => enPeriodo(x.c.fecha, periodo))
  const referencia = antes?.s ?? (enRangoMisma.length > 1 ? enRangoMisma[0]!.s : null)
  const delta = actual !== null && referencia !== null ? actual - referencia : null

  // 4. Serie y lecturas por corrida del periodo.
  const corridasPeriodo = corridas.filter((c) => enPeriodo(c.fecha, periodo))
  const serie: PuntoSerieCompetidor[] = corridasPeriodo
    .filter((c) => c.competidores.includes(competidor) || c.publicaciones?.some((p) => p.competidor === competidor))
    .map((c) => {
      const s = seguidoresEn(c, competidor)
      const propios = (c.publicaciones ?? []).filter((p) => p.competidor === competidor)
      return {
        corrida: c.id,
        fecha: c.fecha,
        seguidores: s,
        posts: propios.length,
        erPromedio: promedio(propios.flatMap((p) => {
          const er = erDe(p, s)
          return er === null ? [] : [er]
        })),
      }
    })
  const lecturas: LecturaFechada[] = corridasPeriodo
    .flatMap((c) =>
      (c.lecturas ?? [])
        .filter((l) => l.competidor === competidor)
        .map((l) => ({ corrida: c.id, fecha: c.fecha, resumen: l.resumen, ...(l.estrategia ? { estrategia: l.estrategia } : {}) })),
    )
    .reverse()

  const top = [...publicaciones]
    .filter((p) => p.er !== null || p.likes !== undefined || p.vistas !== undefined)
    .sort((a, b) => (b.er ?? -1) - (a.er ?? -1) || ((b.likes ?? 0) + (b.comentarios ?? 0)) - ((a.likes ?? 0) + (a.comentarios ?? 0)) || (b.vistas ?? 0) - (a.vistas ?? 0))
    .slice(0, 3)

  const primera = corridas.find((c) => c.competidores.includes(competidor)) ?? corridas[0]
  const coberturaDesde = primera ? primera.ultimaCorrida ?? restarDias(primera.fecha, DIAS_PRIMERA_CORRIDA) : null
  const dias = diasPeriodo(periodo, publicaciones, hoy, coberturaDesde)
  const vistas = valores('vistas')
  const cobertura: Cobertura = publicaciones.length ? (legado.length ? 'parcial' : 'completa') : legado.length ? 'parcial' : 'sin-datos'

  return {
    competidor,
    publicaciones,
    posts,
    cadenciaSemanal: dias && posts ? redondear((posts / dias) * 7, 1) : posts === 0 && dias ? 0 : null,
    likes: cifra(valores('likes'), delLegado('likes')),
    comentarios: cifra(valores('comentarios'), delLegado('comentarios')),
    vistas: { ...cifra(vistas, delLegado('vistas')), mediana: mediana(vistas) },
    er: { promedio: promedio(ers), porFormato },
    formatos,
    seguidores: { actual, delta },
    top,
    cobertura,
    conCifras: publicaciones.filter((p) => p.likes !== undefined || p.comentarios !== undefined || p.vistas !== undefined).length,
    serie,
    lecturas,
  }
}

/** Métricas de todos los competidores indicados (orden de entrada). */
export function metricasMarca(
  corridas: readonly Corrida[],
  competidores: readonly string[],
  o: OpcionesMetricas = {},
): MetricasCompetidor[] {
  return competidores.map((c) => metricasCompetidor(corridas, c, o))
}
