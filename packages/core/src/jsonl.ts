// Lectura y escritura de archivos JSONL validados con zod. La escritura es
// append-only: valida TODOS los items antes de tocar el disco.
import fs from 'node:fs'
import path from 'node:path'
import type { z } from 'zod'

export interface LineaInvalida {
  /** Número de línea (1-based). */
  n: number
  error: string
}

export interface ResultadoLectura<T> {
  items: T[]
  lineasInvalidas: LineaInvalida[]
}

/** Resume un error de zod en una línea legible. */
export function describirErrorZod(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`)
    .join('; ')
}

/**
 * Lee un JSONL validando cada línea. Archivo inexistente → items vacío.
 * Nunca lanza por una línea rota: la reporta en `lineasInvalidas`.
 */
export function leerJsonl<S extends z.ZodType>(ruta: string, schema: S): ResultadoLectura<z.infer<S>> {
  let texto: string
  try {
    texto = fs.readFileSync(ruta, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { items: [], lineasInvalidas: [] }
    throw e
  }
  const items: z.infer<S>[] = []
  const lineasInvalidas: LineaInvalida[] = []
  const lineas = texto.split('\n')
  lineas.forEach((linea, idx) => {
    if (linea.trim() === '') return
    let crudo: unknown
    try {
      crudo = JSON.parse(linea)
    } catch (e) {
      lineasInvalidas.push({ n: idx + 1, error: `JSON inválido: ${(e as Error).message}` })
      return
    }
    const res = schema.safeParse(crudo)
    if (res.success) items.push(res.data as z.infer<S>)
    else lineasInvalidas.push({ n: idx + 1, error: describirErrorZod(res.error) })
  })
  return { items, lineasInvalidas }
}

/**
 * Appendea items validados. Si alguno es inválido no escribe nada y lanza.
 * Crea la carpeta si falta y garantiza que el archivo previo termina en `\n`.
 * Devuelve el número de items escritos.
 */
export function appendJsonl<S extends z.ZodType>(ruta: string, schema: S, items: readonly unknown[]): number {
  const validados: z.infer<S>[] = []
  items.forEach((item, idx) => {
    const res = schema.safeParse(item)
    if (!res.success) throw new Error(`Item ${idx} inválido para ${path.basename(ruta)}: ${describirErrorZod(res.error)}`)
    validados.push(res.data as z.infer<S>)
  })
  if (validados.length === 0) return 0

  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  let prefijo = ''
  try {
    const st = fs.statSync(ruta)
    if (st.size > 0) {
      const fd = fs.openSync(ruta, 'r')
      try {
        const buf = Buffer.alloc(1)
        fs.readSync(fd, buf, 0, 1, st.size - 1)
        if (buf.toString('utf8') !== '\n') prefijo = '\n'
      } finally {
        fs.closeSync(fd)
      }
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
  const cuerpo = validados.map((v) => JSON.stringify(v) + '\n').join('')
  fs.appendFileSync(ruta, prefijo + cuerpo, 'utf8')
  return validados.length
}
