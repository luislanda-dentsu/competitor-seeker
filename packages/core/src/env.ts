// Variables de entorno validadas con zod. `cargarEnv()` es memoizada y lee
// también `<root>/.env.local` y `<root>/.env` (parser mínimo, sin dotenv) sin
// pisar variables ya presentes en el proceso.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { repoRoot } from './rutas.ts'

/** Coerción booleana razonable: "0", "false", "no" y vacío son falso. */
const booleano = z.preprocess((v) => {
  if (typeof v === 'boolean') return v
  if (v === undefined || v === null) return undefined
  const s = String(v).trim().toLowerCase()
  if (s === '') return undefined
  return !['0', 'false', 'no', 'off'].includes(s)
}, z.boolean())

export const Env = z.object({
  CS_REPO_ROOT: z.string().min(1).optional(),
  CLAUDE_BIN: z.string().min(1).default('claude'),
  APIFY_TOKEN: z.string().min(1).optional(),
  CS_GIT_REMOTO: z.string().min(1).default('origin'),
  CS_GIT_RAMA: z.string().min(1).default('main'),
  CS_SYNC_AUTO: booleano.default(true),
  PORT: z.coerce.number().int().positive().default(3030),
  CS_RUNNER: z.enum(['real', 'mock']).default('real'),
})

export type Env = z.infer<typeof Env>

/** Parser KEY=VALUE mínimo: ignora comentarios y líneas vacías; quita comillas simples/dobles. */
export function parsearDotenv(texto: string): Record<string, string> {
  const salida: Record<string, string> = {}
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim()
    if (limpia === '' || limpia.startsWith('#')) continue
    const igual = limpia.indexOf('=')
    if (igual <= 0) continue
    const clave = limpia.slice(0, igual).trim().replace(/^export\s+/, '')
    let valor = limpia.slice(igual + 1).trim()
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1)
    }
    salida[clave] = valor
  }
  return salida
}

function leerDotenvSiExiste(ruta: string): Record<string, string> {
  try {
    return parsearDotenv(fs.readFileSync(ruta, 'utf8'))
  } catch {
    return {}
  }
}

/** Mezcla `process.env` con los .env del repo; lo ya presente en el proceso gana. */
function entornoCrudo(): Record<string, string | undefined> {
  const base: Record<string, string | undefined> = { ...process.env }
  let raiz: string | null = null
  try {
    raiz = repoRoot()
  } catch {
    raiz = null
  }
  if (raiz) {
    // .env.local tiene prioridad sobre .env; ninguno pisa al proceso.
    const archivos = [path.join(raiz, '.env.local'), path.join(raiz, '.env')]
    for (const archivo of archivos) {
      for (const [k, v] of Object.entries(leerDotenvSiExiste(archivo))) {
        if (base[k] === undefined || base[k] === '') base[k] = v
      }
    }
  }
  // Las cadenas vacías se tratan como ausentes para que apliquen los defaults.
  for (const k of Object.keys(base)) if (base[k] === '') base[k] = undefined
  return base
}

let memo: Env | null = null

export function cargarEnv(): Env {
  if (memo) return memo
  memo = Env.parse(entornoCrudo())
  return memo
}

/** Olvida la memoización (para tests o tras cambiar process.env). */
export function reiniciarEnv(): void {
  memo = null
}
