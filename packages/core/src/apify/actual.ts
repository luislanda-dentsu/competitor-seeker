// Uso actual de Apify con caché en `data/apify-uso.json`: combina los límites
// de la API (cacheados 10 min) con las corridas de TODAS las marcas (siempre
// en vivo: son locales y baratas). Única puerta de entrada para la decisión
// de Apify en la app, el CLI y el runner.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { leerConfig, leerSecrets } from '../config.ts'
import { listarCorridas } from '../corridas.ts'
import { listarMarcas } from '../marcas.ts'
import { rutaDataArchivo } from '../rutas.ts'
import { consultarLimites, LimitesApify } from './limites.ts'
import { calcularUso, decidirApify, type DecisionApify, type UsoApify } from './uso.ts'

export const TTL_CACHE_USO_MS = 10 * 60 * 1000

export const CacheUsoApify = z.object({
  /** ISO de cuándo se consultó la API. */
  muestreadoEn: z.string().min(1),
  /** Últimos 4 caracteres del token con el que se consultó (para invalidar al cambiarlo). */
  tokenHuella: z.string().optional(),
  limites: LimitesApify,
})
export type CacheUsoApify = z.infer<typeof CacheUsoApify>

export function rutaCacheUso(): string {
  return rutaDataArchivo('apify-uso.json')
}

export function leerCacheUso(): CacheUsoApify | null {
  const ruta = rutaCacheUso()
  if (!fs.existsSync(ruta)) return null
  try {
    const res = CacheUsoApify.safeParse(JSON.parse(fs.readFileSync(ruta, 'utf8')))
    return res.success ? res.data : null
  } catch {
    return null
  }
}

export function guardarCacheUso(cache: CacheUsoApify): void {
  const ruta = rutaCacheUso()
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  fs.writeFileSync(ruta, JSON.stringify(CacheUsoApify.parse(cache), null, 2) + '\n', 'utf8')
}

/** Borra la caché (p. ej. al cambiar el token o al pedir "actualizar ahora"). */
export function invalidarCacheUso(): void {
  try {
    fs.rmSync(rutaCacheUso(), { force: true })
  } catch {
    /* sin caché: nada que borrar */
  }
}

export function huellaToken(token: string): string {
  return token.slice(-4)
}

export interface EstadoUsoApify {
  /** Hay token (archivo o `APIFY_TOKEN`). */
  configurado: boolean
  uso?: UsoApify
  decision: DecisionApify
  /** ISO de la muestra de la API que respalda `uso` (puede venir de caché). */
  muestreadoEn?: string
  /** Mensaje legible si la API falló y no había caché utilizable. */
  error?: string
}

export interface OpcionesUsoActual {
  /** Ignora la caché aunque esté vigente. */
  forzar?: boolean
  fetchImpl?: typeof fetch
  ahora?: Date
}

function cacheVigente(cache: CacheUsoApify | null, token: string, ahora: Date, forzar: boolean): CacheUsoApify | null {
  if (!cache || forzar) return null
  if (cache.tokenHuella && cache.tokenHuella !== huellaToken(token)) return null
  const t = Date.parse(cache.muestreadoEn)
  if (!Number.isFinite(t) || ahora.getTime() - t > TTL_CACHE_USO_MS) return null
  return cache
}

/**
 * Uso + decisión. Nunca lanza: sin token → `configurado:false`; API caída →
 * usa la caché aunque esté vencida y, si tampoco hay, deja Apify fuera con motivo.
 */
export async function obtenerUsoActual(o: OpcionesUsoActual = {}): Promise<EstadoUsoApify> {
  const cfg = leerConfig().apify
  const resultsLimit = cfg.resultsLimitPorPerfil
  const ahora = o.ahora ?? new Date()
  let token: string | undefined
  try {
    token = leerSecrets().apifyToken
  } catch {
    token = undefined
  }
  if (!token) return { configurado: false, decision: { habilitado: false, motivo: 'sin token', resultsLimit } }

  const previa = leerCacheUso()
  let cache = cacheVigente(previa, token, ahora, o.forzar ?? false)
  let error: string | undefined
  if (!cache) {
    try {
      const limites = await consultarLimites(token, o.fetchImpl)
      cache = { muestreadoEn: ahora.toISOString(), tokenHuella: huellaToken(token), limites }
      guardarCacheUso(cache)
    } catch (e) {
      error = `no se pudo consultar Apify: ${(e as Error).message}`
      // Caché vencida (del mismo token) mejor que nada.
      if (previa && (!previa.tokenHuella || previa.tokenHuella === huellaToken(token))) cache = previa
    }
  }
  if (!cache) {
    return { configurado: true, decision: { habilitado: false, motivo: error ?? 'sin datos de uso', resultsLimit }, error }
  }
  const corridas = listarMarcas().flatMap((m) => listarCorridas(m.slug).corridas)
  const uso = calcularUso(cache.limites, cfg, corridas, ahora)
  const decision = decidirApify(uso, cfg)
  return { configurado: true, uso, decision, muestreadoEn: cache.muestreadoEn, ...(error ? { error } : {}) }
}
