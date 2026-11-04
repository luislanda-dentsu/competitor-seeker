import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { calcularUso } from '../src/apify/uso.ts'
import {
  contarNoLeidas,
  emitirNotificacion,
  evaluarUmbralesApify,
  listarNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  notificarFinCorrida,
  rutaNotificaciones,
} from '../src/notificaciones.ts'
import { ConfigApify } from '../src/schemas/config.ts'
import type { Corrida } from '../src/schemas/corrida.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

const cfg = ConfigApify.parse({})
const ahora = new Date(2026, 10, 3, 12, 0, 0)
const limites = (usado: number, limite = 100) => ({
  ciclo: { inicio: '2026-11-01T00:00:00.000Z', fin: '2026-12-01T00:00:00.000Z' },
  mensual: { usadoUsd: usado, limiteUsd: limite },
})
const usoMensual = (pct: number) => calcularUso(limites(pct), cfg, [], ahora)

function corrida(extra: Partial<Corrida> = {}): Corrida {
  return {
    id: '2026-11-03-1200-mac', marca: 'kolareal', fecha: '2026-11-03', ultimaCorrida: null, inicio: ahora.toISOString(),
    estado: 'registrada', verificado: true, intentos: 1, objeciones: [], fuentes: [], competidores: [],
    entradas: [], modo: 'ui', maquina: 'mac', ...extra,
  }
}

let repo: RepoTemporal
beforeEach(() => {
  repo = crearRepoTemporal()
})
afterEach(() => repo.limpiar())

describe('notificaciones', () => {
  it('emite, deduplica por clave y lista no leídas', () => {
    const a = emitirNotificacion({ tipo: 'git-error', nivel: 'aviso', titulo: 'x', mensaje: 'y', clave: 'k1', ahora })
    expect(a).not.toBeNull()
    expect(emitirNotificacion({ tipo: 'git-error', nivel: 'aviso', titulo: 'x', mensaje: 'y', clave: 'k1' })).toBeNull()
    const b = emitirNotificacion({ tipo: 'corrida-ok', nivel: 'info', titulo: 'z', mensaje: '', clave: 'k2', ahora: new Date(ahora.getTime() + 1000) })
    expect(fs.existsSync(rutaNotificaciones())).toBe(true)
    const lista = listarNotificaciones()
    expect(lista.map((n) => n.id)).toEqual([b!.id, a!.id]) // más recientes primero
    expect(contarNoLeidas()).toBe(2)
    expect(listarNotificaciones({ noLeidas: true, limite: 1 })).toHaveLength(1)
  })

  it('marcarLeida y marcarTodasLeidas', () => {
    const a = emitirNotificacion({ tipo: 'git-error', nivel: 'aviso', titulo: 'x', mensaje: 'y', clave: 'k1' })!
    emitirNotificacion({ tipo: 'git-error', nivel: 'aviso', titulo: 'x', mensaje: 'y', clave: 'k2' })
    expect(marcarLeida('no-existe')).toBe(false)
    expect(marcarLeida(a.id)).toBe(true)
    expect(listarNotificaciones({ noLeidas: true })).toHaveLength(1)
    expect(marcarTodasLeidas()).toBe(1)
    expect(marcarTodasLeidas()).toBe(0)
    expect(contarNoLeidas()).toBe(0)
    // Dedupe sigue aplicando a las leídas.
    expect(emitirNotificacion({ tipo: 'git-error', nivel: 'aviso', titulo: 'x', mensaje: 'y', clave: 'k1' })).toBeNull()
  })

  it('umbrales 69/70/90/100: una sola vez por ciclo y por umbral', () => {
    expect(evaluarUmbralesApify(usoMensual(69), cfg, ahora)).toHaveLength(0)
    const al70 = evaluarUmbralesApify(usoMensual(70), cfg, ahora)
    expect(al70).toHaveLength(1)
    expect(al70[0]!.clave).toBe('apify-mensual-70-2026-11-01')
    expect(al70[0]!.nivel).toBe('info')
    // Segunda evaluación al 75 %: nada nuevo.
    expect(evaluarUmbralesApify(usoMensual(75), cfg, ahora)).toHaveLength(0)
    const al90 = evaluarUmbralesApify(usoMensual(90), cfg, ahora)
    expect(al90.map((n) => n.clave)).toEqual(['apify-mensual-90-2026-11-01'])
    expect(al90[0]!.nivel).toBe('aviso')
    const al100 = evaluarUmbralesApify(usoMensual(100), cfg, ahora)
    expect(al100.map((n) => n.clave)).toEqual(['apify-mensual-100-2026-11-01'])
    expect(al100[0]!.nivel).toBe('critico')
    expect(evaluarUmbralesApify(usoMensual(130), cfg, ahora)).toHaveLength(0)
    expect(listarNotificaciones().filter((n) => n.tipo === 'apify-umbral')).toHaveLength(3)
    // Nuevo ciclo → se vuelve a avisar.
    const otroCiclo = calcularUso(
      { ciclo: { inicio: '2026-12-01T00:00:00.000Z', fin: '2027-01-01T00:00:00.000Z' }, mensual: { usadoUsd: 70, limiteUsd: 100 } },
      cfg, [], ahora,
    )
    expect(evaluarUmbralesApify(otroCiclo, cfg, ahora).map((n) => n.clave)).toEqual(['apify-mensual-70-2026-12-01'])
  })

  it('un salto directo al 100 % emite los tres umbrales de golpe', () => {
    const claves = evaluarUmbralesApify(usoMensual(100), cfg, ahora).map((n) => n.clave)
    expect(claves).toEqual(['apify-mensual-70-2026-11-01', 'apify-mensual-90-2026-11-01', 'apify-mensual-100-2026-11-01'])
  })

  it('ventanas diaria y semanal usan su propio periodo', () => {
    const cfgDia = { ...cfg, presupuesto: { mensualUsd: 100, diarioUsd: 1, semanalUsd: 1 } }
    const gasto: Corrida = corrida({ apify: { resultados: 370, costeEstimadoUsd: 1 } })
    const uso = calcularUso(limites(0), cfgDia, [gasto], ahora)
    const claves = evaluarUmbralesApify(uso, cfg, ahora).map((n) => n.clave).sort()
    expect(claves).toEqual([
      'apify-diario-100-2026-11-03', 'apify-diario-70-2026-11-03', 'apify-diario-90-2026-11-03',
      'apify-semanal-100-2026-11-02', 'apify-semanal-70-2026-11-02', 'apify-semanal-90-2026-11-02',
    ])
  })

  it('notificarFinCorrida por estado, ig y git; idempotente', () => {
    const ok = notificarFinCorrida(corrida(), ahora)
    expect(ok.map((n) => n.tipo)).toEqual(['corrida-ok'])
    expect(ok[0]!.href).toBe('/corridas/2026-11-03-1200-mac')
    expect(notificarFinCorrida(corrida(), ahora)).toHaveLength(0)

    const rechazada = notificarFinCorrida(
      corrida({ id: 'r1', estado: 'pendiente-confirmacion', verificado: false, intentos: 3, ig: { sesion: 'no-disponible' }, git: { pushed: false, error: 'sin remoto' } }),
      ahora,
    )
    expect(rechazada.map((n) => n.tipo).sort()).toEqual(['corrida-rechazada', 'git-error', 'ig-sesion'])
    expect(rechazada.find((n) => n.tipo === 'ig-sesion')!.href).toBe('/ajustes')

    const error = notificarFinCorrida(corrida({ id: 'e1', estado: 'error', error: 'cancelada' }), ahora)
    expect(error).toHaveLength(1)
    expect(error[0]!.nivel).toBe('critico')
    expect(error[0]!.mensaje).toBe('cancelada')
    expect(notificarFinCorrida(corrida({ id: 'c1', estado: 'en-curso' }), ahora)).toHaveLength(0)
  })
})

describe('recortar', () => {
  it('descarta primero las leídas más antiguas y conserva las no leídas', async () => {
    const { recortar, MAX_NOTIFICACIONES } = await import('../src/notificaciones.ts')
    const base = { tipo: 'corrida-ok' as const, nivel: 'info' as const, titulo: 't', mensaje: 'm' }
    const items = Array.from({ length: MAX_NOTIFICACIONES + 3 }, (_, i) => ({
      ...base, id: `n${i}`, ts: new Date(2026, 0, 1, 0, i).toISOString(), clave: `k${i}`, leida: i >= 10 && i < 13,
    }))
    const r = recortar(items)
    expect(r).toHaveLength(MAX_NOTIFICACIONES)
    expect(r.some((n) => n.id === 'n0')).toBe(true)
    expect(r.filter((n) => n.leida)).toHaveLength(0)
  })
})
