// Resolución de rutas del repo. Todo módulo de I/O pasa por aquí: nadie
// construye rutas a mano fuera de este archivo.
import fs from 'node:fs'
import path from 'node:path'

const ARCHIVO_LOG = 'log.jsonl'

/** ¿Es `dir` la raíz del proyecto? Debe tener CLAUDE.md y la carpeta marcas/. */
function esRaiz(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, 'CLAUDE.md')).isFile() && fs.statSync(path.join(dir, 'marcas')).isDirectory()
  } catch {
    return false
  }
}

/**
 * Raíz del repo. Si existe `CS_REPO_ROOT` se usa tal cual (resuelta a absoluta);
 * si no, sube desde `desde` hasta encontrar `CLAUDE.md` + `marcas/`.
 */
export function repoRoot(desde: string = process.cwd()): string {
  const fijada = process.env.CS_REPO_ROOT
  if (fijada && fijada.trim() !== '') {
    const abs = path.resolve(fijada.trim())
    if (!esRaiz(abs)) throw new Error(`CS_REPO_ROOT no apunta a la raíz del proyecto (falta CLAUDE.md o marcas/): ${abs}`)
    return abs
  }
  let actual = path.resolve(desde)
  for (;;) {
    if (esRaiz(actual)) return actual
    const padre = path.dirname(actual)
    if (padre === actual) break
    actual = padre
  }
  throw new Error(`No se encontró la raíz del proyecto subiendo desde ${desde} (se busca CLAUDE.md + marcas/)`)
}

export function rutaMarcas(): string {
  return path.join(repoRoot(), 'marcas')
}

export function rutaMarca(slug: string): string {
  return path.join(rutaMarcas(), slug)
}

export function rutaMarcaJson(slug: string): string {
  return path.join(rutaMarca(slug), 'marca.json')
}

export function rutaLog(slug: string): string {
  return path.join(rutaMarca(slug), ARCHIVO_LOG)
}

export function rutaCorridas(slug: string): string {
  return path.join(rutaMarca(slug), 'corridas')
}

export function rutaCorrida(slug: string, id: string): string {
  return path.join(rutaCorridas(slug), `${id}.json`)
}

/** Estado local no sincronizado: `<root>/data` (gitignored). */
export function rutaData(): string {
  return path.join(repoRoot(), 'data')
}

export function rutaDataArchivo(...partes: string[]): string {
  return path.join(rutaData(), ...partes)
}

/** Configuración compartida (sí se sincroniza por git). */
export function rutaConfig(): string {
  return path.join(repoRoot(), 'config.json')
}
