// Uso de Apify por ventana (día / semana / ciclo mensual) y decisión de
// habilitarlo en la próxima corrida. Funciones puras.
import type { Corrida } from '../schemas/corrida.ts'
import type { ConfigApify } from '../schemas/config.ts'
import type { LimitesApify } from './limites.ts'

export interface VentanaUso {
  usadoUsd: number
  limiteUsd: number
  /** 0–100 (puede superar 100). Si el límite es 0, 100 cuando hay gasto, 0 si no. */
  pct: number
}

export interface UsoApify {
  ciclo: { inicio: string; fin: string }
  mensual: VentanaUso
  diario: VentanaUso
  semanal: VentanaUso
}

const DIA_MS = 24 * 60 * 60 * 1000

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

export function pct(usado: number, limite: number): number {
  if (limite <= 0) return usado > 0 ? 100 : 0
  return Math.round((usado / limite) * 1000) / 10
}

function ventana(usado: number, limite: number): VentanaUso {
  return { usadoUsd: redondear(usado), limiteUsd: redondear(limite), pct: pct(usado, limite) }
}

function diasDelCiclo(limites: LimitesApify): number {
  const ini = Date.parse(limites.ciclo.inicio)
  const fin = Date.parse(limites.ciclo.fin)
  if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) return 30
  return Math.max(1, Math.round((fin - ini) / DIA_MS))
}

function inicioDiaLocal(ahora: Date): number {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime()
}

function costeEnVentana(corridas: readonly Corrida[], desde: number, hasta: number): number {
  return corridas.reduce((acc, c) => {
    const t = Date.parse(c.inicio)
    if (!Number.isFinite(t) || t < desde || t > hasta) return acc
    return acc + (c.apify?.costeEstimadoUsd ?? 0)
  }, 0)
}

/**
 * Mensual: real según la API (o presupuesto de config si está fijado).
 * Diario y semanal: suma de `corrida.apify.costeEstimadoUsd` de las corridas en ventana
 * (hoy local; últimos 7 días) contra presupuestos derivados.
 */
export function calcularUso(limites: LimitesApify, cfg: ConfigApify, corridas: readonly Corrida[], ahora: Date = new Date()): UsoApify {
  const limiteMensual = cfg.presupuesto.mensualUsd ?? limites.mensual.limiteUsd
  const limiteDiario = cfg.presupuesto.diarioUsd ?? limiteMensual / diasDelCiclo(limites)
  const limiteSemanal = cfg.presupuesto.semanalUsd ?? limiteDiario * 7
  const t = ahora.getTime()
  return {
    ciclo: { ...limites.ciclo },
    mensual: ventana(limites.mensual.usadoUsd, limiteMensual),
    diario: ventana(costeEnVentana(corridas, inicioDiaLocal(ahora), t), limiteDiario),
    semanal: ventana(costeEnVentana(corridas, t - 7 * DIA_MS, t), limiteSemanal),
  }
}

export interface DecisionApify {
  habilitado: boolean
  motivo?: string
  resultsLimit: number
}

export function decidirApify(uso: UsoApify, cfg: ConfigApify): DecisionApify {
  const resultsLimit = cfg.resultsLimitPorPerfil
  if (!cfg.habilitado) return { habilitado: false, motivo: 'deshabilitado en config', resultsLimit }
  if (uso.mensual.pct >= cfg.saltarSiPctMensual) {
    return { habilitado: false, motivo: `uso mensual ${uso.mensual.pct}% ≥ ${cfg.saltarSiPctMensual}%`, resultsLimit }
  }
  if (uso.diario.pct >= 100) return { habilitado: false, motivo: `presupuesto diario agotado (${uso.diario.pct}%)`, resultsLimit }
  if (uso.semanal.pct >= 100) return { habilitado: false, motivo: `presupuesto semanal agotado (${uso.semanal.pct}%)`, resultsLimit }
  return { habilitado: true, resultsLimit }
}

/** Mayor umbral alcanzado por `pctActual` (p. ej. 70, 90 o 100), o null si ninguno. */
export function umbralAlcanzado(pctActual: number, umbrales: readonly number[]): number | null {
  const alcanzados = umbrales.filter((u) => pctActual >= u)
  return alcanzados.length ? Math.max(...alcanzados) : null
}
