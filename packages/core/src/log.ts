// `log.jsonl` por marca: append-only e idempotente por id. Este módulo es el
// ÚNICO escritor del log; nunca reescribe ni borra líneas.
import { createHash } from 'node:crypto'
import { appendJsonl, leerJsonl, type ResultadoLectura } from './jsonl.ts'
import { rutaLog } from './rutas.ts'
import { Entrada, EntradaAgente } from './schemas/entrada.ts'

/** sha1(`marca|fecha|movimiento`) truncado a 16 hex: determinista entre máquinas. */
export function idEntrada(e: Pick<EntradaAgente, 'marca' | 'fecha' | 'movimiento'>): string {
  return createHash('sha1').update(`${e.marca}|${e.fecha}|${e.movimiento}`, 'utf8').digest('hex').slice(0, 16)
}

/** Convierte una EntradaAgente en Entrada persistible (nuevo objeto). */
export function conId(e: EntradaAgente, corridaId: string): Entrada {
  return Entrada.parse({ ...e, id: idEntrada(e), corrida: corridaId })
}

export function leerLog(slug: string): ResultadoLectura<Entrada> {
  return leerJsonl(rutaLog(slug), Entrada)
}

export interface ResultadoRegistro {
  registradas: number
  /** Ids que ya existían en el log y se omitieron. */
  duplicadas: string[]
  /** Entradas efectivamente escritas, ya con id y corrida. */
  entradas: Entrada[]
}

/**
 * Appendea al log las entradas que aún no existen (por id). Valida todo antes
 * de escribir y nunca toca lo ya registrado.
 */
export function registrarEntradas(slug: string, corridaId: string, entradas: readonly EntradaAgente[]): ResultadoRegistro {
  const nuevas = entradas.map((e) => conId(EntradaAgente.parse(e), corridaId))
  const existentes = new Set(leerLog(slug).items.map((e) => e.id))
  const duplicadas: string[] = []
  const vistas = new Set<string>()
  const aEscribir: Entrada[] = []
  for (const e of nuevas) {
    if (existentes.has(e.id) || vistas.has(e.id)) {
      duplicadas.push(e.id)
      continue
    }
    vistas.add(e.id)
    aEscribir.push(e)
  }
  const registradas = appendJsonl(rutaLog(slug), Entrada, aEscribir)
  return { registradas, duplicadas, entradas: aEscribir }
}

/** Agrupa por `marca` (nombre del competidor) conservando el orden de aparición. */
export function entradasPorCompetidor<T extends { marca: string }>(entradas: readonly T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const e of entradas) {
    const lista = grupos.get(e.marca)
    if (lista) grupos.set(e.marca, [...lista, e])
    else grupos.set(e.marca, [e])
  }
  return grupos
}
