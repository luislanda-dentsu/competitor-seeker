// Alta, lectura y archivo de marcas (`marcas/<slug>/marca.json`).
import fs from 'node:fs'
import path from 'node:path'
import { competidorDesde, slugify, type CompetidorTxt } from './competidores.ts'
import { describirErrorZod } from './jsonl.ts'
import { rutaCorridas, rutaLog, rutaMarca, rutaMarcaJson, rutaMarcas } from './rutas.ts'
import { Marca, type Competidor } from './schemas/marca.ts'

const CARPETA_ARCHIVO = '_archivo'

function leerMarcaJson(ruta: string): Marca | null {
  let crudo: unknown
  try {
    crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  } catch {
    return null
  }
  const res = Marca.safeParse(crudo)
  return res.success ? res.data : null
}

/** Carpetas de `marcas/` con un `marca.json` válido. Ignora `_archivo`. */
export function listarMarcas(): Marca[] {
  const base = rutaMarcas()
  let nombres: string[]
  try {
    nombres = fs.readdirSync(base)
  } catch {
    return []
  }
  const marcas: Marca[] = []
  for (const nombre of nombres.sort()) {
    if (nombre === CARPETA_ARCHIVO || nombre.startsWith('.')) continue
    const carpeta = path.join(base, nombre)
    if (!fs.statSync(carpeta).isDirectory()) continue
    const marca = leerMarcaJson(path.join(carpeta, 'marca.json'))
    if (marca) marcas.push(marca)
  }
  return marcas
}

export function leerMarca(slug: string): Marca {
  const ruta = rutaMarcaJson(slug)
  let crudo: unknown
  try {
    crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  } catch (e) {
    throw new Error(`No se pudo leer ${ruta}: ${(e as Error).message}`)
  }
  const res = Marca.safeParse(crudo)
  if (!res.success) throw new Error(`marca.json inválido (${slug}): ${describirErrorZod(res.error)}`)
  return res.data
}

export function existeMarca(slug: string): boolean {
  return fs.existsSync(rutaMarcaJson(slug))
}

/** Escribe `marca.json` (pretty, 2 espacios) y garantiza `log.jsonl` + `corridas/`. */
export function guardarMarca(marca: Marca): Marca {
  const valida = Marca.parse(marca)
  fs.mkdirSync(rutaMarca(valida.slug), { recursive: true })
  fs.mkdirSync(rutaCorridas(valida.slug), { recursive: true })
  const log = rutaLog(valida.slug)
  if (!fs.existsSync(log)) fs.writeFileSync(log, '', 'utf8')
  fs.writeFileSync(rutaMarcaJson(valida.slug), JSON.stringify(valida, null, 2) + '\n', 'utf8')
  return valida
}

export interface NuevaMarca {
  nombre: string
  competidores?: CompetidorTxt[]
  /** Slug explícito; por defecto `slugify(nombre)`. */
  slug?: string
  ahora?: Date
}

/** Crea `marcas/<slug>/` con `marca.json`, `log.jsonl` vacío y `corridas/`. Falla si ya existe. */
export function crearMarca(datos: NuevaMarca): Marca {
  const slug = datos.slug ?? slugify(datos.nombre)
  if (!slug) throw new Error(`No se pudo derivar un slug de "${datos.nombre}"`)
  if (existeMarca(slug)) throw new Error(`La marca "${slug}" ya existe`)
  if (fs.existsSync(path.join(rutaMarcas(), CARPETA_ARCHIVO, slug))) {
    throw new Error(`La marca "${slug}" está archivada en marcas/${CARPETA_ARCHIVO}/; restáurala a mano`)
  }
  const marca: Marca = {
    slug,
    nombre: datos.nombre,
    creadaEn: (datos.ahora ?? new Date()).toISOString(),
    competidores: (datos.competidores ?? []).map(competidorDesde),
  }
  return guardarMarca(marca)
}

/** Mueve la carpeta a `marcas/_archivo/<slug>`. Nunca borra. */
export function archivarMarca(slug: string): string {
  const origen = rutaMarca(slug)
  if (!fs.existsSync(origen)) throw new Error(`La marca "${slug}" no existe`)
  const carpetaArchivo = path.join(rutaMarcas(), CARPETA_ARCHIVO)
  fs.mkdirSync(carpetaArchivo, { recursive: true })
  let destino = path.join(carpetaArchivo, slug)
  if (fs.existsSync(destino)) destino = `${destino}-${Date.now()}`
  fs.renameSync(origen, destino)
  return destino
}

export function competidoresActivos(marca: Marca): Competidor[] {
  return marca.competidores.filter((c) => c.activo)
}
