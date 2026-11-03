// Metadatos de corrida: `marcas/<slug>/corridas/<id>.json`.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describirErrorZod } from './jsonl.ts'
import { rutaCorrida, rutaCorridas } from './rutas.ts'
import { Corrida } from './schemas/corrida.ts'
import type { FechaISO } from './schemas/entrada.ts'

/** Hostname sin dominio, minúsculas, solo [a-z0-9-], máximo 12 caracteres. */
export function hostCorto(hostname: string = os.hostname()): string {
  const base = hostname.split('.')[0] ?? ''
  const limpio = base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return (limpio || 'host').slice(0, 12).replace(/-+$/g, '') || 'host'
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/** Fecha local `AAAA-MM-DD`. */
export function fechaLocal(ahora: Date = new Date()): FechaISO {
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`
}

/**
 * `${AAAA-MM-DD}-${HHmm}-${slug}-${hostCorto}`: lleva la marca (dos marcas en el
 * mismo minuto no comparten id ni stream) y la máquina (no colisiona entre equipos).
 */
export function nuevoIdCorrida(slug: string, ahora: Date = new Date(), host: string = hostCorto()): string {
  return `${fechaLocal(ahora)}-${dosDigitos(ahora.getHours())}${dosDigitos(ahora.getMinutes())}-${slug}-${host}`
}

/** Id de corrida válido: lo que produce `nuevoIdCorrida` o la migración (sin rutas ni separadores raros). */
export function esIdCorridaValido(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(id) && !id.includes('..')
}

export interface CorridaInvalida {
  archivo: string
  error: string
}

export interface ListadoCorridas {
  corridas: Corrida[]
  invalidas: CorridaInvalida[]
}

/** Todas las corridas de la marca, ordenadas por `inicio` descendente. Reporta archivos inválidos. */
export function listarCorridas(slug: string): ListadoCorridas {
  const carpeta = rutaCorridas(slug)
  let archivos: string[]
  try {
    archivos = fs.readdirSync(carpeta).filter((a) => a.endsWith('.json'))
  } catch {
    return { corridas: [], invalidas: [] }
  }
  const corridas: Corrida[] = []
  const invalidas: CorridaInvalida[] = []
  for (const archivo of archivos) {
    const ruta = path.join(carpeta, archivo)
    try {
      const res = Corrida.safeParse(JSON.parse(fs.readFileSync(ruta, 'utf8')))
      if (res.success) corridas.push(res.data)
      else invalidas.push({ archivo, error: describirErrorZod(res.error) })
    } catch (e) {
      invalidas.push({ archivo, error: (e as Error).message })
    }
  }
  corridas.sort((a, b) => (a.inicio < b.inicio ? 1 : a.inicio > b.inicio ? -1 : b.id.localeCompare(a.id)))
  return { corridas, invalidas }
}

export function existeCorrida(slug: string, id: string): boolean {
  return fs.existsSync(rutaCorrida(slug, id))
}

export function leerCorrida(slug: string, id: string): Corrida {
  const ruta = rutaCorrida(slug, id)
  let crudo: unknown
  try {
    crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  } catch (e) {
    throw new Error(`No se pudo leer la corrida ${id} de ${slug}: ${(e as Error).message}`)
  }
  const res = Corrida.safeParse(crudo)
  if (!res.success) throw new Error(`Corrida ${id} inválida: ${describirErrorZod(res.error)}`)
  return res.data
}

/** Escribe `corridas/<id>.json` (pretty). Crea la carpeta si falta. */
export function guardarCorrida(corrida: Corrida): Corrida {
  const valida = Corrida.parse(corrida)
  const ruta = rutaCorrida(valida.marca, valida.id)
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  fs.writeFileSync(ruta, JSON.stringify(valida, null, 2) + '\n', 'utf8')
  return valida
}

/** Mayor `fecha` entre las corridas `registrada`, o null si no hay ninguna. */
export function ultimaCorridaRegistrada(slug: string): FechaISO | null {
  const registradas = listarCorridas(slug).corridas.filter((c) => c.estado === 'registrada')
  if (registradas.length === 0) return null
  return registradas.reduce<string>((max, c) => (c.fecha > max ? c.fecha : max), registradas[0]!.fecha)
}

/** Corrida `registrada` más reciente (por fecha, luego inicio), o null. */
export function ultimaCorridaObjeto(corridas: readonly Corrida[]): Corrida | null {
  const registradas = corridas.filter((c) => c.estado === 'registrada')
  if (registradas.length === 0) return null
  return registradas.reduce((mejor, c) => {
    if (c.fecha > mejor.fecha) return c
    if (c.fecha === mejor.fecha && c.inicio > mejor.inicio) return c
    return mejor
  })
}
