// Migración del formato legacy (log.json + competidores.txt + index.html) al
// nuevo (log.jsonl + marca.json + corridas/<fecha>-migrada.json). Idempotente.
import fs from 'node:fs'
import path from 'node:path'
import { parseCompetidoresTxt } from './competidores.ts'
import { listarCorridas, guardarCorrida, existeCorrida } from './corridas.ts'
import { appendJsonl, describirErrorZod, leerJsonl } from './jsonl.ts'
import { conId, leerLog } from './log.ts'
import { crearMarca, existeMarca, leerMarca } from './marcas.ts'
import { rutaCorridas, rutaLog, rutaMarca } from './rutas.ts'
import { Corrida } from './schemas/corrida.ts'
import { Entrada, EntradaAgente, FechaISO } from './schemas/entrada.ts'
import { z } from 'zod'

export interface ResumenMigracion {
  entradas: number
  competidores: number
  corridaId: string
  yaMigrada: boolean
}

/** Extrae `corrida` del bloque `<script type="application/json" id="datos">`. */
export function fechaCorridaDesdeIndex(html: string): FechaISO | null {
  const m = html.match(/<script[^>]*id="datos"[^>]*>([\s\S]*?)<\/script>/i)
  if (!m || !m[1]) return null
  try {
    const datos = JSON.parse(m[1]) as { corrida?: unknown; demo?: unknown }
    if (datos.demo === true) return null
    const res = FechaISO.safeParse(datos.corrida)
    return res.success ? res.data : null
  } catch {
    return null
  }
}

function capitalizar(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function camposIguales(a: Entrada, b: Entrada): boolean {
  const claves = ['id', 'corrida', 'marca', 'fecha', 'movimiento', 'senal', 'lectura'] as const
  return claves.every((k) => a[k] === b[k])
}

function resumenYaMigrada(slug: string): ResumenMigracion {
  const marca = leerMarca(slug)
  const migrada = listarCorridas(slug).corridas.find((c) => c.modo === 'migrada')
  return {
    entradas: leerLog(slug).items.length,
    competidores: marca.competidores.length,
    corridaId: migrada?.id ?? '',
    yaMigrada: true,
  }
}

export function migrarMarca(slug: string): ResumenMigracion {
  const carpeta = rutaMarca(slug)
  const rutaLegacy = path.join(carpeta, 'log.json')
  const rutaTxt = path.join(carpeta, 'competidores.txt')
  const rutaIndex = path.join(carpeta, 'index.html')

  if (!fs.existsSync(rutaLegacy)) {
    if (existeMarca(slug)) return resumenYaMigrada(slug)
    throw new Error(`Nada que migrar en ${carpeta}: no hay log.json ni marca.json`)
  }

  // 1. Log legacy validado entrada por entrada.
  let crudo: unknown
  try {
    crudo = JSON.parse(fs.readFileSync(rutaLegacy, 'utf8'))
  } catch (e) {
    throw new Error(`log.json ilegible: ${(e as Error).message}`)
  }
  const parse = z.array(EntradaAgente).safeParse(crudo)
  if (!parse.success) throw new Error(`log.json inválido: ${describirErrorZod(parse.error)}`)
  const legacy = parse.data

  // 2. Fecha de corrida: del panel; si no, la mayor fecha del log.
  let fecha: FechaISO | null = null
  if (fs.existsSync(rutaIndex)) fecha = fechaCorridaDesdeIndex(fs.readFileSync(rutaIndex, 'utf8'))
  if (!fecha) fecha = legacy.reduce<string | null>((max, e) => (max === null || e.fecha > max ? e.fecha : max), null)
  if (!fecha) throw new Error('No se pudo determinar la fecha de la corrida migrada (log vacío y sin index.html)')
  const corridaId = `${fecha}-migrada`

  // 3. log.jsonl: solo las ids que falten; relectura y comparación campo a campo.
  const entradas = legacy.map((e) => conId(e, corridaId))
  const ruta = rutaLog(slug)
  const previas = leerJsonl(ruta, Entrada).items
  const idsPrevias = new Set(previas.map((e) => e.id))
  const faltantes = entradas.filter((e, i) => !idsPrevias.has(e.id) && entradas.findIndex((x) => x.id === e.id) === i)
  const tamanoPrevio = fs.existsSync(ruta) ? fs.statSync(ruta).size : 0
  appendJsonl(ruta, Entrada, faltantes)

  const releido = leerJsonl(ruta, Entrada)
  const porId = new Map(releido.items.map((e) => [e.id, e]))
  const discrepancia = entradas.find((e) => {
    const guardada = porId.get(e.id)
    return !guardada || !camposIguales(e, guardada)
  })
  if (releido.lineasInvalidas.length > 0 || discrepancia) {
    fs.truncateSync(ruta, tamanoPrevio)
    throw new Error(
      discrepancia
        ? `La relectura de log.jsonl no coincide con log.json en la entrada ${discrepancia.id}; se revirtió lo escrito`
        : `log.jsonl tiene líneas inválidas tras escribir; se revirtió lo escrito`,
    )
  }

  // 4. Corrida sintética.
  const nombresUnicos = [...new Set(legacy.map((e) => e.marca))]
  if (!existeCorrida(slug, corridaId)) {
    const corrida: Corrida = {
      id: corridaId,
      marca: slug,
      fecha,
      ultimaCorrida: null,
      inicio: `${fecha}T00:00:00.000Z`,
      fin: `${fecha}T00:00:00.000Z`,
      duracionMs: 0,
      estado: 'registrada',
      verificado: true,
      intentos: 0,
      objeciones: [],
      fuentes: ['web', 'ig'],
      competidores: nombresUnicos,
      entradas: entradas.map((e) => ({ ...e })),
      modo: 'migrada',
      maquina: 'migracion',
    }
    guardarCorrida(corrida)
  }

  // 5. competidores.txt → marca.json (si ya existe marca.json se respeta).
  if (!existeMarca(slug)) {
    const lista = fs.existsSync(rutaTxt)
      ? parseCompetidoresTxt(fs.readFileSync(rutaTxt, 'utf8'))
      : nombresUnicos.map((nombre) => ({ nombre }))
    crearMarca({ nombre: capitalizar(slug), slug, competidores: lista })
  }
  fs.mkdirSync(rutaCorridas(slug), { recursive: true })

  // 6. Retirar el formato viejo (log.json se conserva renombrado; nunca se borra).
  fs.renameSync(rutaLegacy, `${rutaLegacy}.migrado`)
  if (fs.existsSync(rutaIndex)) fs.rmSync(rutaIndex)
  if (fs.existsSync(rutaTxt)) fs.rmSync(rutaTxt)

  return {
    entradas: releido.items.length,
    competidores: leerMarca(slug).competidores.length,
    corridaId,
    yaMigrada: false,
  }
}
