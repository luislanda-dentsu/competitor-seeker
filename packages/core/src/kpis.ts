// Indicadores puros sobre entradas y corridas (sin I/O).
import { ultimaCorridaObjeto } from './corridas.ts'
import type { Corrida } from './schemas/corrida.ts'
import type { Entrada, Senal } from './schemas/entrada.ts'

/** Prioridad ante empate de fecha: la señal más grave manda. */
const PRIORIDAD: Record<Senal, number> = { 'no-funciona': 3, confuso: 2, nuevo: 1, 'sin-datos': 0 }

export function prioridadSenal(senal: Senal): number {
  return PRIORIDAD[senal]
}

/** Por competidor, la entrada más reciente por `fecha`; empate → señal más grave. */
export function semaforoPorCompetidor<T extends Pick<Entrada, 'marca' | 'fecha' | 'senal'>>(
  entradas: readonly T[],
): Map<string, T> {
  const mapa = new Map<string, T>()
  for (const e of entradas) {
    const actual = mapa.get(e.marca)
    if (!actual) {
      mapa.set(e.marca, e)
      continue
    }
    if (e.fecha > actual.fecha || (e.fecha === actual.fecha && PRIORIDAD[e.senal] > PRIORIDAD[actual.senal])) {
      mapa.set(e.marca, e)
    }
  }
  return mapa
}

export type ConteoSenales = Record<Senal, number>

export function conteoPorSenal(entradas: readonly Pick<Entrada, 'senal'>[]): ConteoSenales {
  const base: ConteoSenales = { nuevo: 0, confuso: 0, 'sin-datos': 0, 'no-funciona': 0 }
  return entradas.reduce<ConteoSenales>((acc, e) => ({ ...acc, [e.senal]: acc[e.senal] + 1 }), base)
}

export interface KpisMarca {
  competidoresVigilados: number
  movimientosNuevosUltimaCorrida: number
  /** Diferencia de `nuevo` frente a la corrida registrada anterior; null si no hay anterior. */
  deltaVsAnterior: number | null
  /** % de entradas con señal distinta de `sin-datos` (0–100, un decimal). */
  pctConEvidencia: number
  ultimaCorrida: Corrida | null
}

function corridasRegistradasOrdenadas(corridas: readonly Corrida[]): Corrida[] {
  return corridas
    .filter((c) => c.estado === 'registrada')
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0))
}

function nuevosDeCorrida(entradas: readonly Entrada[], corridaId: string): number {
  return entradas.filter((e) => e.corrida === corridaId && e.senal === 'nuevo').length
}

export function kpisMarca(datos: {
  entradas: readonly Entrada[]
  corridas: readonly Corrida[]
  /** Si se conoce la lista de vigilancia, prevalece sobre los nombres vistos en el log. */
  competidoresVigilados?: number
}): KpisMarca {
  const { entradas, corridas } = datos
  const ultima = ultimaCorridaObjeto(corridas)
  const ordenadas = corridasRegistradasOrdenadas(corridas)
  const anterior = ultima ? ordenadas.filter((c) => c.id !== ultima.id).at(-1) ?? null : null
  const nuevosUltima = ultima ? nuevosDeCorrida(entradas, ultima.id) : 0
  const conEvidencia = entradas.filter((e) => e.senal !== 'sin-datos').length
  return {
    competidoresVigilados: datos.competidoresVigilados ?? new Set(entradas.map((e) => e.marca)).size,
    movimientosNuevosUltimaCorrida: nuevosUltima,
    deltaVsAnterior: anterior ? nuevosUltima - nuevosDeCorrida(entradas, anterior.id) : null,
    pctConEvidencia: entradas.length === 0 ? 0 : Math.round((conEvidencia / entradas.length) * 1000) / 10,
    ultimaCorrida: ultima,
  }
}

export interface PuntoSerie {
  corridaId: string
  fecha: string
  nuevo: number
  confuso: number
  sinDatos: number
  noFunciona: number
}

/** Conteo por señal para cada corrida registrada, en orden cronológico. */
export function seriePorCorrida(entradas: readonly Entrada[], corridas: readonly Corrida[]): PuntoSerie[] {
  return corridasRegistradasOrdenadas(corridas).map((c) => {
    const conteo = conteoPorSenal(entradas.filter((e) => e.corrida === c.id))
    return {
      corridaId: c.id,
      fecha: c.fecha,
      nuevo: conteo.nuevo,
      confuso: conteo.confuso,
      sinDatos: conteo['sin-datos'],
      noFunciona: conteo['no-funciona'],
    }
  })
}
