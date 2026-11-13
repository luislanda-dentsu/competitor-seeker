// Corrida histórica (v2.3): estimación de coste, validación de la ventana y que una
// histórica no mueva la ventana de la siguiente corrida normal ni la «última corrida».
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promptCorrida } from '../src/claude/prompts.ts'
import { guardarCorrida, ultimaCorridaIgRegistrada, ultimaCorridaRegistrada } from '../src/corridas.ts'
import { estimarCorridaHistorica, TOPE_MAX_POSTS, TOPE_MIN_POSTS, validarVentana } from '../src/historica.ts'
import { kpisMarca } from '../src/kpis.ts'
import { metricasCompetidor } from '../src/metricas.ts'
import { Corrida, ResultadoWorkflow } from '../src/schemas/corrida.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

const A = 'Alpha'
const B = 'Bravo'

function corrida(over: Record<string, unknown> & { id: string; fecha: string }): Corrida {
  return Corrida.parse({
    marca: 'k',
    ultimaCorrida: null,
    inicio: `${over.fecha}T10:00:00Z`,
    estado: 'registrada',
    verificado: true,
    intentos: 1,
    modo: 'ui',
    maquina: 'mac',
    competidores: [A, B],
    ...over,
  })
}

const post = (competidor: string, id: string, fecha: string, extra: Record<string, unknown> = {}) => ({
  competidor,
  url: `https://www.instagram.com/p/${id}/`,
  fecha,
  formato: 'imagen',
  fuente: 'apify',
  ...extra,
})

const VENTANA = { desde: '2025-11-01', hasta: '2025-12-31' }

describe('estimarCorridaHistorica', () => {
  it('usa la cadencia observada en posts de Apify y la supuesta si no hay historial', () => {
    // Alpha: 10 posts en 10 días → 1/día. Bravo sin posts → 0,5/día por defecto.
    const posts = Array.from({ length: 10 }, (_, i) => post(A, `a${i}`, `2026-11-${String(i + 1).padStart(2, '0')}`))
    const e = estimarCorridaHistorica([corrida({ id: 'n1', fecha: '2026-11-10', publicaciones: posts })], [A, B], VENTANA)
    expect(e.dias).toBe(61)
    expect(e.competidores).toEqual([
      { competidor: A, cadencia: 1, observada: true, postsEstimados: 61 },
      { competidor: B, cadencia: 0.5, observada: false, postsEstimados: 31 },
    ])
    expect(e.postsEstimados).toBe(92)
    // 92 × 1,5 + 5 extra por perfil (fijados y márgenes).
    expect(e.topePosts).toBe(148)
    expect(e.costeEstimadoUsd).toBe(0.28)
    expect(e.costeMaximoUsd).toBe(0.4)
  })

  it('una histórica previa no hunde la cadencia de la siguiente estimación', () => {
    const recientes = Array.from({ length: 10 }, (_, i) => post(A, `a${i}`, `2026-11-${String(i + 1).padStart(2, '0')}`))
    const viejos = [post(A, 'v1', '2025-11-05'), post(A, 'v2', '2025-12-05')]
    const corridas = [
      corrida({ id: 'n1', fecha: '2026-11-10', publicaciones: recientes }),
      corrida({ id: 'h1', fecha: '2026-11-13', tipo: 'historica', ventana: VENTANA, publicaciones: viejos }),
    ]
    expect(estimarCorridaHistorica(corridas, [A], VENTANA).competidores[0]!.cadencia).toBe(1)
  })

  it('el tope queda entre el mínimo y el máximo', () => {
    const corta = estimarCorridaHistorica([], [A], { desde: '2025-11-01', hasta: '2025-11-02' })
    expect(corta.topePosts).toBe(TOPE_MIN_POSTS)
    const muchos = Array.from({ length: 30 }, (_, i) => post(A, `m${i}`, '2026-11-01'))
    const densa = estimarCorridaHistorica([corrida({ id: 'n1', fecha: '2026-11-01', publicaciones: [...muchos, post(A, 'z', '2026-11-07')] })], [A, B], VENTANA)
    expect(densa.topePosts).toBe(TOPE_MAX_POSTS)
    expect(densa.costeMaximoUsd).toBe(0.54)
  })

  it('sin competidores con Instagram no hay nada que cobrar', () => {
    const e = estimarCorridaHistorica([], [], VENTANA)
    expect(e.topePosts).toBe(0)
    expect(e.costeMaximoUsd).toBe(0)
  })
})

describe('validarVentana', () => {
  const hoy = '2026-11-13'
  it('acepta una ventana pasada de hasta 92 días', () => {
    expect(validarVentana(VENTANA, hoy)).toBeNull()
  })
  it('rechaza fechas mal formadas, invertidas, que llegan a hoy o demasiado largas', () => {
    expect(validarVentana({ desde: '2025-11', hasta: '2025-12-31' }, hoy)).toMatch(/desde/)
    expect(validarVentana({ desde: '2025-12-31', hasta: '2025-11-01' }, hoy)).toMatch(/posterior/)
    expect(validarVentana({ desde: '2026-11-01', hasta: '2026-11-13' }, hoy)).toMatch(/antes de hoy/)
    expect(validarVentana({ desde: '2025-01-01', hasta: '2025-12-31' }, hoy)).toMatch(/92 días/)
  })
  it('el schema de Corrida rechaza una ventana invertida', () => {
    expect(() => corrida({ id: 'h', fecha: '2026-11-13', tipo: 'historica', ventana: { desde: '2025-12-31', hasta: '2025-11-01' } })).toThrow()
  })
})

describe('una histórica no mueve la ventana ni la última corrida', () => {
  let repo: RepoTemporal
  beforeEach(() => { repo = crearRepoTemporal() })
  afterEach(() => repo.limpiar())

  it('ultimaCorrida, ultimaCorridaIg y el KPI ignoran la histórica', () => {
    const normal = corrida({ id: 'n', fecha: '2026-11-04', ig: { sesion: 'ok' } })
    const historica = corrida({ id: 'h', fecha: '2026-11-13', tipo: 'historica', ventana: VENTANA, ig: { sesion: 'ok' } })
    guardarCorrida(normal)
    guardarCorrida(historica)
    expect(ultimaCorridaRegistrada('k')).toBe('2026-11-04')
    expect(ultimaCorridaIgRegistrada('k')).toBe('2026-11-04')
    expect(kpisMarca({ entradas: [], corridas: [historica, normal] }).ultimaCorrida?.id).toBe('n')
  })
})

describe('métricas de un periodo cubierto por una histórica', () => {
  it('cuenta los días de la ventana (cadencia) aunque la primera corrida normal sea posterior', () => {
    const normal = corrida({ id: 'n', fecha: '2026-11-04', ultimaCorrida: '2026-10-20' })
    const historica = corrida({
      id: 'h',
      fecha: '2026-11-13',
      tipo: 'historica',
      ventana: VENTANA,
      publicaciones: [post(A, 'h1', '2025-11-10', { likes: 10 }), post(A, 'h2', '2025-12-01', { likes: 30 })],
    })
    const m = metricasCompetidor([normal, historica], A, { periodo: VENTANA, hoy: '2026-11-13' })
    expect(m.posts).toBe(2)
    expect(m.likes.total).toBe(40)
    expect(m.cadenciaSemanal).toBe(0.2)
  })
})

describe('métricas: el hueco entre la histórica y las normales no cuenta', () => {
  const normal = corrida({
    id: 'n',
    fecha: '2026-11-04',
    ultimaCorrida: '2026-10-29',
    publicaciones: [post(A, 'n1', '2026-11-01')],
  })
  const historica = corrida({
    id: 'h',
    fecha: '2026-11-13',
    tipo: 'historica',
    ventana: { desde: '2025-12-01', hasta: '2025-12-07' },
    publicaciones: [post(A, 'h1', '2025-12-03')],
    lecturas: [{ competidor: A, resumen: ['Diciembre 2025'] }],
  })

  it('«todo» cuenta solo los días cubiertos (7 de la ventana + 2026-10-29 → hoy)', () => {
    const m = metricasCompetidor([normal, historica], A, { hoy: '2026-11-04' })
    expect(m.posts).toBe(2)
    // 7 + 7 = 14 días → 2 posts / 14 × 7 = 1 por semana (no 2 / ~339 días).
    expect(m.cadenciaSemanal).toBe(1)
  })

  it('la serie y las lecturas de la histórica llevan la fecha de su ventana, en orden', () => {
    const m = metricasCompetidor([historica, normal], A, { hoy: '2026-11-13' })
    expect(m.serie.map((p) => [p.corrida, p.fecha])).toEqual([['h', '2025-12-07'], ['n', '2026-11-04']])
    expect(m.lecturas[0]?.fecha).toBe('2025-12-07')
    // Un periodo reciente no trae la lectura de 2025.
    const reciente = metricasCompetidor([historica, normal], A, { periodo: { desde: '2026-10-01', hasta: '2026-11-13' }, hoy: '2026-11-13' })
    expect(reciente.lecturas).toEqual([])
  })
})

describe('prompt y registro de una histórica', () => {
  it('el prompt pasa la ventana y el tope al workflow', () => {
    const p = promptCorrida({
      marca: 'parval',
      fechaCorrida: '2026-11-13',
      ultimaCorrida: '2026-11-04',
      corridaId: 'c1',
      apify: { habilitado: true, resultsLimit: 12, topePosts: 120 },
      ventana: VENTANA,
    })
    expect(p).toContain('CORRIDA HISTÓRICA')
    expect(p).toContain('ventana: {"desde":"2025-11-01","hasta":"2025-12-31"}')
    expect(p).toContain('"topePosts":120')
  })

  it('el prompt de una corrida normal no menciona ventana', () => {
    const p = promptCorrida({ marca: 'parval', fechaCorrida: '2026-11-13', ultimaCorrida: null, corridaId: 'c1', apify: { habilitado: false, resultsLimit: 12 } })
    expect(p).not.toContain('HISTÓRICA')
    expect(p).not.toContain('ventana:')
  })

  it('ResultadoWorkflow acepta la ventana', () => {
    const r = ResultadoWorkflow.parse({ entradas: [], verificado: true, ventana: VENTANA })
    expect(r.ventana).toEqual(VENTANA)
  })
})
