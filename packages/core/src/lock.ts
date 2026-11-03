// Lock global de corrida en `data/corrida.lock` (creación atómica con `wx`).
// Un lock cuyo pid ya no vive, o con más de `MAX_EDAD_LOCK_MS` de antigüedad
// (pid reutilizado por otro proceso), se considera huérfano y se reemplaza.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { rutaDataArchivo } from './rutas.ts'

export const ContenidoLock = z.object({
  pid: z.number().int().positive(),
  corridaId: z.string().min(1),
  marca: z.string().min(1),
  inicio: z.string().min(1),
  host: z.string().min(1),
})
export type ContenidoLock = z.infer<typeof ContenidoLock>

export class LockOcupado extends Error {
  readonly lock: ContenidoLock
  constructor(lock: ContenidoLock) {
    super(`Ya hay una corrida en curso (${lock.corridaId}, marca ${lock.marca}, pid ${lock.pid} en ${lock.host})`)
    this.name = 'LockOcupado'
    this.lock = lock
  }
}

export function rutaLock(): string {
  return rutaDataArchivo('corrida.lock')
}

/** Ninguna corrida dura tanto: pasado este tiempo el lock es huérfano aunque el pid viva. */
export const MAX_EDAD_LOCK_MS = 6 * 60 * 60 * 1000

/** Huérfano: pid muerto, o `inicio` más viejo que `MAX_EDAD_LOCK_MS` (pid reutilizado). */
export function esLockHuerfano(lock: ContenidoLock, ahora: Date = new Date()): boolean {
  if (!procesoVivo(lock.pid)) return true
  const inicio = Date.parse(lock.inicio)
  return Number.isFinite(inicio) && ahora.getTime() - inicio > MAX_EDAD_LOCK_MS
}

/** Contenido actual del lock, o null si no existe o está corrupto. */
export function leerLock(): ContenidoLock | null {
  try {
    const res = ContenidoLock.safeParse(JSON.parse(fs.readFileSync(rutaLock(), 'utf8')))
    return res.success ? res.data : null
  } catch {
    return null
  }
}

export function procesoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM: existe pero no es nuestro → vivo. ESRCH → no existe.
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export interface OpcionesLock {
  corridaId: string
  marca: string
  pid?: number
  host?: string
  ahora?: Date
}

function escribirExclusivo(ruta: string, contenido: ContenidoLock): boolean {
  try {
    const fd = fs.openSync(ruta, 'wx')
    try {
      fs.writeSync(fd, JSON.stringify(contenido) + '\n')
    } finally {
      fs.closeSync(fd)
    }
    return true
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw e
  }
}

/** Toma el lock o lanza `LockOcupado`. Un lock huérfano (pid muerto o archivo corrupto) se reemplaza. */
export function adquirirLock(opciones: OpcionesLock): ContenidoLock {
  const ruta = rutaLock()
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  const ahora = opciones.ahora ?? new Date()
  const contenido: ContenidoLock = {
    pid: opciones.pid ?? process.pid,
    corridaId: opciones.corridaId,
    marca: opciones.marca,
    inicio: ahora.toISOString(),
    host: opciones.host ?? os.hostname(),
  }
  if (escribirExclusivo(ruta, contenido)) return contenido

  const actual = leerLock()
  if (actual && !esLockHuerfano(actual, ahora)) throw new LockOcupado(actual)

  // Relectura justo antes de retirarlo: si otro proceso lo reemplazó entre
  // medias (pid o inicio distintos), el dueño nuevo manda y no lo tocamos.
  const relectura = leerLock()
  if (relectura && (!actual || relectura.pid !== actual.pid || relectura.inicio !== actual.inicio)) {
    throw new LockOcupado(relectura)
  }

  // Huérfano o corrupto: lo retiramos y reintentamos una sola vez.
  try {
    fs.rmSync(ruta, { force: true })
  } catch {
    /* si otro proceso lo quitó antes, el wx siguiente decide */
  }
  if (escribirExclusivo(ruta, contenido)) return contenido
  const ganador = leerLock()
  if (ganador) throw new LockOcupado(ganador)
  throw new Error('No se pudo adquirir el lock de corrida')
}

/** Libera el lock. Si se pasa `corridaId`, solo lo libera si le pertenece. */
export function liberarLock(corridaId?: string): boolean {
  const actual = leerLock()
  if (corridaId && actual && actual.corridaId !== corridaId) return false
  try {
    fs.rmSync(rutaLock(), { force: true })
    return true
  } catch {
    return false
  }
}
