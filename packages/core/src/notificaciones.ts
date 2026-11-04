// Notificaciones locales (`data/notificaciones.jsonl`): umbrales de Apify,
// cierre de corridas, sesión de Instagram y errores de git. Dedupe por `clave`.
// Es estado local (no es el log de una marca): marcar leída reescribe el archivo.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { fechaLocal } from './corridas.ts'
import { appendJsonl, leerJsonl } from './jsonl.ts'
import { rutaDataArchivo } from './rutas.ts'
import type { ConfigApify } from './schemas/config.ts'
import type { Corrida } from './schemas/corrida.ts'
import type { UsoApify } from './apify/uso.ts'

export const TipoNotificacion = z.enum(['apify-umbral', 'corrida-ok', 'corrida-rechazada', 'git-error', 'ig-sesion'])
export type TipoNotificacion = z.infer<typeof TipoNotificacion>

export const NivelNotificacion = z.enum(['info', 'aviso', 'critico'])
export type NivelNotificacion = z.infer<typeof NivelNotificacion>

export const Notificacion = z.object({
  id: z.string().min(1),
  /** ISO. */
  ts: z.string().min(1),
  tipo: TipoNotificacion,
  nivel: NivelNotificacion,
  titulo: z.string().min(1),
  mensaje: z.string(),
  /** Clave de deduplicación: dos emisiones con la misma clave son una sola notificación. */
  clave: z.string().min(1),
  leida: z.boolean().default(false),
  href: z.string().optional(),
})
export type Notificacion = z.infer<typeof Notificacion>

/** Máximo de notificaciones conservadas (las más antiguas se descartan al reescribir). */
export const MAX_NOTIFICACIONES = 500

export function rutaNotificaciones(): string {
  return rutaDataArchivo('notificaciones.jsonl')
}

function leerTodas(): Notificacion[] {
  return leerJsonl(rutaNotificaciones(), Notificacion).items
}

/** Recorta a MAX_NOTIFICACIONES descartando primero las leídas más antiguas. */
export function recortar(items: readonly Notificacion[]): Notificacion[] {
  if (items.length <= MAX_NOTIFICACIONES) return [...items]
  let sobran = items.length - MAX_NOTIFICACIONES
  const sinLeidasViejas = items.filter((n) => {
    if (sobran > 0 && n.leida) { sobran--; return false }
    return true
  })
  return sinLeidasViejas.slice(-MAX_NOTIFICACIONES)
}

/** Escritura atómica: archivo temporal + rename (nunca deja el archivo truncado). */
function reescribir(items: readonly Notificacion[]): void {
  const ruta = rutaNotificaciones()
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  const tmp = `${ruta}.${process.pid}.tmp`
  fs.writeFileSync(tmp, recortar(items).map((n) => JSON.stringify(n) + '\n').join(''), 'utf8')
  fs.renameSync(tmp, ruta)
}

/**
 * Exclusión mutua entre leer-modificar-escribir (append de emisiones vs. marcar leída).
 * Lock por archivo `wx`; locks de más de 10 s se consideran huérfanos.
 */
function conLock<T>(fn: () => T): T {
  const lock = `${rutaNotificaciones()}.lock`
  fs.mkdirSync(path.dirname(lock), { recursive: true })
  const limite = Date.now() + 2000
  for (;;) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' })
      break
    } catch {
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 10_000) { fs.rmSync(lock, { force: true }); continue }
      } catch { continue }
      if (Date.now() > limite) throw new Error('notificaciones ocupadas: no se pudo tomar el lock')
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20)
    }
  }
  try { return fn() } finally { fs.rmSync(lock, { force: true }) }
}

function nuevoId(ahora: Date): string {
  return `${ahora.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface NuevaNotificacion {
  tipo: TipoNotificacion
  nivel: NivelNotificacion
  titulo: string
  mensaje: string
  clave: string
  href?: string
  ahora?: Date
}

/** Appendea la notificación. Si ya existe una con la misma `clave`, no hace nada y devuelve null. */
export function emitirNotificacion(datos: NuevaNotificacion): Notificacion | null {
  return conLock(() => emitirSinLock(datos))
}

function emitirSinLock(datos: NuevaNotificacion): Notificacion | null {
  const todas = leerTodas()
  if (todas.some((n) => n.clave === datos.clave)) return null
  const ahora = datos.ahora ?? new Date()
  const notificacion: Notificacion = {
    id: nuevoId(ahora),
    ts: ahora.toISOString(),
    tipo: datos.tipo,
    nivel: datos.nivel,
    titulo: datos.titulo,
    mensaje: datos.mensaje,
    clave: datos.clave,
    leida: false,
    ...(datos.href ? { href: datos.href } : {}),
  }
  if (todas.length + 1 > MAX_NOTIFICACIONES) reescribir([...todas, notificacion])
  else appendJsonl(rutaNotificaciones(), Notificacion, [notificacion])
  return notificacion
}

export interface FiltroNotificaciones {
  noLeidas?: boolean
  limite?: number
}

/** Más recientes primero. */
export function listarNotificaciones(filtro: FiltroNotificaciones = {}): Notificacion[] {
  let items = leerTodas()
  if (filtro.noLeidas) items = items.filter((n) => !n.leida)
  items.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
  if (filtro.limite !== undefined && filtro.limite >= 0) items = items.slice(0, filtro.limite)
  return items
}

export function contarNoLeidas(): number {
  return leerTodas().filter((n) => !n.leida).length
}

/** true si existía y se marcó (o ya estaba leída). */
export function marcarLeida(id: string): boolean {
  return conLock(() => {
  const items = leerTodas()
  const idx = items.findIndex((n) => n.id === id)
  if (idx < 0) return false
  if (!items[idx]!.leida) {
    items[idx] = { ...items[idx]!, leida: true }
    reescribir(items)
  }
  return true
  })
}

/** Devuelve cuántas cambiaron. */
export function marcarTodasLeidas(): number {
  return conLock(() => {
    const items = leerTodas()
    const pendientes = items.filter((n) => !n.leida).length
    if (pendientes === 0) return 0
    reescribir(items.map((n) => (n.leida ? n : { ...n, leida: true })))
    return pendientes
  })
}

const VENTANAS = ['diario', 'semanal', 'mensual'] as const
type Ventana = (typeof VENTANAS)[number]

const ETIQUETA_VENTANA: Record<Ventana, string> = { diario: 'de hoy', semanal: 'de la semana', mensual: 'del ciclo mensual' }

function inicioSemanaLocal(ahora: Date): string {
  const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const dow = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dow)
  return fechaLocal(d)
}

/**
 * Identificador del periodo de cada ventana para la clave de dedupe:
 * mensual → inicio del ciclo de Apify; diario → fecha local; semanal → lunes local.
 */
export function periodoVentana(ventana: Ventana, uso: UsoApify, ahora: Date): string {
  if (ventana === 'mensual') return uso.ciclo.inicio.slice(0, 10)
  if (ventana === 'diario') return fechaLocal(ahora)
  return inicioSemanaLocal(ahora)
}

export function nivelPorUmbral(umbral: number): NivelNotificacion {
  if (umbral >= 100) return 'critico'
  if (umbral >= 90) return 'aviso'
  return 'info'
}

/**
 * Emite una notificación por cada umbral cruzado en cada ventana, una sola vez
 * por periodo: `clave = apify-<ventana>-<umbral>-<periodo>`. Devuelve las nuevas.
 */
export function evaluarUmbralesApify(uso: UsoApify, cfg: Pick<ConfigApify, 'umbrales'>, ahora: Date = new Date()): Notificacion[] {
  const nuevas: Notificacion[] = []
  const umbrales = [...cfg.umbrales].sort((a, b) => a - b)
  for (const ventana of VENTANAS) {
    const v = uso[ventana]
    for (const umbral of umbrales) {
      if (v.pct < umbral) continue
      const periodo = periodoVentana(ventana, uso, ahora)
      const n = emitirNotificacion({
        tipo: 'apify-umbral',
        nivel: nivelPorUmbral(umbral),
        titulo: umbral >= 100 ? `Presupuesto ${ETIQUETA_VENTANA[ventana]} de Apify agotado` : `Apify al ${umbral} % ${ETIQUETA_VENTANA[ventana]}`,
        mensaje: `Uso ${ETIQUETA_VENTANA[ventana]}: $${v.usadoUsd.toFixed(2)} de $${v.limiteUsd.toFixed(2)} (${v.pct} %).`,
        clave: `apify-${ventana}-${umbral}-${periodo}`,
        href: '/ajustes',
        ahora,
      })
      if (n) nuevas.push(n)
    }
  }
  return nuevas
}

/**
 * Notificaciones al terminar una corrida: `corrida-ok` (registrada),
 * `corrida-rechazada` (pendiente de confirmación o error), `ig-sesion` si la
 * sesión de Instagram no estaba disponible y `git-error` si el push falló.
 * Idempotente por corrida gracias a la clave.
 */
export function notificarFinCorrida(corrida: Corrida, ahora: Date = new Date()): Notificacion[] {
  const nuevas: Notificacion[] = []
  const href = `/corridas/${corrida.id}`
  const base = { href, ahora }
  const emitir = (n: Notificacion | null) => {
    if (n) nuevas.push(n)
  }
  if (corrida.estado === 'registrada') {
    const n = corrida.entradas.length
    emitir(
      emitirNotificacion({
        ...base,
        tipo: 'corrida-ok',
        nivel: 'info',
        titulo: `Corrida de ${corrida.marca} registrada`,
        mensaje: `${n} ${n === 1 ? 'entrada' : 'entradas'} verificada${n === 1 ? '' : 's'} en ${corrida.intentos} ${corrida.intentos === 1 ? 'intento' : 'intentos'}.`,
        clave: `corrida-${corrida.id}-ok`,
      }),
    )
  } else if (corrida.estado === 'pendiente-confirmacion') {
    emitir(
      emitirNotificacion({
        ...base,
        tipo: 'corrida-rechazada',
        nivel: 'aviso',
        titulo: `Corrida de ${corrida.marca} pendiente de confirmación`,
        mensaje: `El verificador rechazó las entradas tras ${corrida.intentos} ${corrida.intentos === 1 ? 'intento' : 'intentos'} (${corrida.objeciones.length} objeciones). Nada se registró.`,
        clave: `corrida-${corrida.id}-rechazada`,
      }),
    )
  } else if (corrida.estado === 'error') {
    emitir(
      emitirNotificacion({
        ...base,
        tipo: 'corrida-rechazada',
        nivel: 'critico',
        titulo: `Corrida de ${corrida.marca} con error`,
        mensaje: corrida.error ?? 'La corrida terminó sin registrar.',
        clave: `corrida-${corrida.id}-error`,
      }),
    )
  }
  if (corrida.ig?.sesion === 'no-disponible') {
    emitir(
      emitirNotificacion({
        ...base,
        tipo: 'ig-sesion',
        nivel: 'aviso',
        titulo: 'Sesión de Instagram no disponible',
        mensaje: `La corrida ${corrida.id} siguió solo con web (+Apify). Cierra el Chrome dedicado si está abierto o vuelve a iniciar sesión (Ajustes → Abrir Instagram).`,
        clave: `corrida-${corrida.id}-ig-sesion`,
        href: '/ajustes',
      }),
    )
  }
  if (corrida.git && !corrida.git.pushed && corrida.git.error) {
    emitir(
      emitirNotificacion({
        ...base,
        tipo: 'git-error',
        nivel: 'aviso',
        titulo: 'No se pudo sincronizar con git',
        mensaje: corrida.git.error,
        clave: `corrida-${corrida.id}-git-error`,
      }),
    )
  }
  return nuevas
}
