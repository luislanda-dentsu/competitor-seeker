// Corrida histórica: estimación de posts y coste de Apify para una ventana pasada (sin I/O).
// El navegador localiza los posts de la ventana y Apify se consulta SOLO con esas URLs
// (un resultado por URL), así que el coste depende de cuántos posts hay en la ventana.
import { USD_POR_RESULTADO } from './apify/coste.ts'
import { clavePublicacion } from './schemas/publicacion.ts'
import type { Corrida, VentanaCorrida } from './schemas/corrida.ts'

/** Cadencia supuesta para un competidor sin posts de Apify registrados (posts/día). */
export const CADENCIA_POR_DEFECTO = 0.5
/** Margen sobre la estimación para el tope de URLs que se mandan a Apify. */
export const MARGEN_TOPE = 1.5
export const TOPE_MIN_POSTS = 20
/** Máximo de URLs por corrida histórica (una lectura de dataset de Apify trae hasta 200). */
export const TOPE_MAX_POSTS = 200
/** Ventana máxima permitida (días): acota el recorrido del navegador y el coste. */
export const MAX_DIAS_VENTANA = 92

const DIA_MS = 24 * 60 * 60 * 1000

export function diasVentana(v: VentanaCorrida): number {
  return Math.round((Date.parse(v.hasta) - Date.parse(v.desde)) / DIA_MS) + 1
}

export interface EstimacionCompetidor {
  competidor: string
  /** Posts por día observados (o por defecto). */
  cadencia: number
  /** true si la cadencia sale de posts registrados; false si es la supuesta por defecto. */
  observada: boolean
  postsEstimados: number
}

export interface EstimacionHistorica {
  dias: number
  competidores: EstimacionCompetidor[]
  postsEstimados: number
  costeEstimadoUsd: number
  /** Máximo de URLs que se enviarán a Apify. */
  topePosts: number
  costeMaximoUsd: number
}

function redondearUsd(n: number): number {
  return Math.round(n * 100) / 100
}

/** Posts/día de un competidor según los posts de Apify ya registrados (sin duplicados). */
function cadenciaObservada(corridas: readonly Corrida[], competidor: string): number | null {
  const fechas = new Map<string, string>()
  for (const c of corridas) {
    if (c.estado !== 'registrada') continue
    for (const p of c.publicaciones ?? []) {
      if (p.competidor !== competidor || p.fuente !== 'apify') continue
      fechas.set(clavePublicacion(p.url), p.fecha)
    }
  }
  if (fechas.size < 2) return null
  const orden = [...fechas.values()].sort()
  const dias = Math.max(7, Math.round((Date.parse(orden.at(-1)!) - Date.parse(orden[0]!)) / DIA_MS) + 1)
  return fechas.size / dias
}

/**
 * Estima posts y coste de Apify de una corrida histórica para los competidores con Instagram.
 * El tope (estimación × 1,5, entre 20 y 200) es lo máximo que se cobrará.
 */
export function estimarCorridaHistorica(
  corridas: readonly Corrida[],
  competidoresIg: readonly string[],
  ventana: VentanaCorrida,
  usdPorResultado: number = USD_POR_RESULTADO,
): EstimacionHistorica {
  const dias = diasVentana(ventana)
  const competidores = competidoresIg.map((competidor) => {
    const obs = cadenciaObservada(corridas, competidor)
    const cadencia = obs ?? CADENCIA_POR_DEFECTO
    return { competidor, cadencia: Math.round(cadencia * 100) / 100, observada: obs !== null, postsEstimados: Math.ceil(cadencia * dias) }
  })
  const postsEstimados = competidores.reduce((a, c) => a + c.postsEstimados, 0)
  const topePosts = competidores.length === 0
    ? 0
    : Math.min(TOPE_MAX_POSTS, Math.max(TOPE_MIN_POSTS, Math.ceil(postsEstimados * MARGEN_TOPE)))
  return {
    dias,
    competidores,
    postsEstimados,
    costeEstimadoUsd: redondearUsd(Math.min(postsEstimados, topePosts) * usdPorResultado),
    topePosts,
    costeMaximoUsd: redondearUsd(topePosts * usdPorResultado),
  }
}

export type ErrorVentana = string

/** Valida una ventana histórica: fechas ISO, desde ≤ hasta, hasta < hoy, como mucho MAX_DIAS_VENTANA. */
export function validarVentana(v: { desde?: unknown; hasta?: unknown }, hoy: string): ErrorVentana | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (typeof v.desde !== 'string' || !iso.test(v.desde) || Number.isNaN(Date.parse(v.desde))) return 'Fecha «desde» inválida (AAAA-MM-DD)'
  if (typeof v.hasta !== 'string' || !iso.test(v.hasta) || Number.isNaN(Date.parse(v.hasta))) return 'Fecha «hasta» inválida (AAAA-MM-DD)'
  if (v.desde > v.hasta) return '«Desde» es posterior a «hasta»'
  if (v.hasta >= hoy) return 'La ventana debe terminar antes de hoy (para lo reciente usa una corrida normal)'
  if (diasVentana({ desde: v.desde, hasta: v.hasta }) > MAX_DIAS_VENTANA) return `La ventana no puede pasar de ${MAX_DIAS_VENTANA} días`
  return null
}
