import { describe, expect, it } from 'vitest'
import { erDe, metricasCompetidor, metricasMarca } from '../src/metricas.ts'
import { Corrida } from '../src/schemas/corrida.ts'

const CC = 'Country Club RD'

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
    competidores: [CC],
    ...over,
  })
}

const post = (id: string, fecha: string, extra: Record<string, unknown> = {}) => ({
  competidor: CC,
  url: `https://www.instagram.com/p/${id}/`,
  fecha,
  formato: 'reel',
  fuente: 'apify',
  ...extra,
})

const c1 = corrida({
  id: '2026-10-20-a',
  fecha: '2026-10-20',
  publicaciones: [post('A', '2026-10-18', { likes: 90, comentarios: 10, vistas: 1000 }), post('B', '2026-10-15', { formato: 'carrusel', likes: 40, comentarios: 0 })],
  perfiles: [{ competidor: CC, seguidores: 10_000, fuente: 'apify' }],
  lecturas: [{ competidor: CC, resumen: ['Reels de torneo'] }],
})
const c2 = corrida({
  id: '2026-11-03-b',
  fecha: '2026-11-03',
  // Vuelve a ver A con más likes: deben prevalecer las cifras nuevas.
  publicaciones: [post('A', '2026-10-18', { likes: 190, comentarios: 10, vistas: 3000 }), post('C', '2026-11-01', { formato: 'imagen', likes: 30 })],
  perfiles: [{ competidor: CC, seguidores: 10_500, fuente: 'apify' }],
  lecturas: [
    {
      competidor: CC,
      resumen: ['Imagen de menú'],
      estrategia: { hipotesis: ['Eventos'], pilares: [], formatosYCadencia: 'Reels', implicaciones: [], confianza: 'baja', postsCitados: [] },
    },
  ],
})
const pendiente = corrida({ id: '2026-11-04-p', fecha: '2026-11-04', estado: 'pendiente-confirmacion', publicaciones: [post('Z', '2026-11-04', { likes: 999 })] })

describe('metricasCompetidor', () => {
  it('deduplica posts entre corridas (gana la más reciente) e ignora corridas no registradas', () => {
    const m = metricasCompetidor([c1, c2, pendiente], CC, { hoy: '2026-11-04' })
    expect(m.publicaciones.map((p) => p.url.slice(-2, -1))).toEqual(['C', 'A', 'B'])
    expect(m.posts).toBe(3)
    const a = m.publicaciones.find((p) => p.url.includes('/A/'))!
    expect(a.likes).toBe(190)
    expect(a.corrida).toBe('2026-11-03-b')
    // ER de A con seguidores de su corrida (10.500): 200/10500*100
    expect(a.er).toBe(1.9)
    // B solo en c1 → seguidores 10.000: 40/10000*100
    expect(m.publicaciones.find((p) => p.url.includes('/B/'))!.er).toBe(0.4)
    expect(m.likes).toEqual({ total: 260, promedio: 86.7, n: 3 })
    expect(m.vistas.total).toBe(3000)
    expect(m.vistas.mediana).toBe(3000)
    expect(m.formatos).toEqual({ reel: 1, carrusel: 1, imagen: 1 })
    expect(m.seguidores).toEqual({ actual: 10_500, delta: 500 })
    expect(m.top[0]!.url).toContain('/A/')
    expect(m.cobertura).toBe('completa')
    expect(m.lecturas.map((l) => l.corrida)).toEqual(['2026-11-03-b', '2026-10-20-a'])
  })

  it('filtra por periodo según la fecha del post y calcula delta de seguidores contra el snapshot anterior', () => {
    const m = metricasCompetidor([c1, c2], CC, { periodo: { desde: '2026-10-25', hasta: '2026-11-04' } })
    expect(m.publicaciones.map((p) => p.url)).toEqual(['https://www.instagram.com/p/C/'])
    expect(m.seguidores).toEqual({ actual: 10_500, delta: 500 })
    expect(m.cadenciaSemanal).toBe(0.6) // 1 post en 11 días
    expect(m.lecturas).toHaveLength(1)
    expect(m.lecturas[0]!.estrategia?.confianza).toBe('baja')
  })

  it('corridas antiguas sin publicaciones: totales desde Entrada.metricas, cobertura parcial, ER null', () => {
    const vieja = corrida({
      id: '2026-08-20-m',
      fecha: '2026-08-20',
      entradas: [
        { id: '0123456789abcdef', corrida: '2026-08-20-m', marca: CC, fecha: '2026-08-19', movimiento: 'x', senal: 'nuevo', lectura: 'y', metricas: { likes: 400, comentarios: 20, posts: 4 } },
        { id: '0123456789abcde0', corrida: '2026-08-20-m', marca: CC, fecha: '2026-08-19', movimiento: 'x', senal: 'nuevo', lectura: 'y', metricas: { likes: 100 } },
      ],
    })
    const m = metricasCompetidor([vieja], CC, { hoy: '2026-11-04' })
    expect(m.cobertura).toBe('parcial')
    expect(m.posts).toBe(4)
    expect(m.likes.total).toBe(400) // la entrada sin recuento de posts no se suma (duplicaría posts)
    expect(m.likes.promedio).toBe(100)
    expect(m.er.promedio).toBeNull()
    expect(m.publicaciones).toEqual([])
  })

  it('una corrida posterior sin cifras no borra las cifras que trajo Apify antes', () => {
    const soloIg = corrida({ id: '2026-11-10-c', fecha: '2026-11-10', publicaciones: [post('A', '2026-10-18', { fuente: 'ig', tema: 'Torneo' })] })
    const m = metricasCompetidor([c1, soloIg], CC, { hoy: '2026-11-10' })
    const a = m.publicaciones.find((p) => p.url.includes('/A/'))!
    expect(a).toMatchObject({ likes: 90, vistas: 1000, tema: 'Torneo', corrida: '2026-10-20-a', er: 1 })
  })

  it('la cadencia no se diluye en días anteriores a la cobertura de la primera corrida', () => {
    const unica = corrida({ id: '2026-11-03-u', fecha: '2026-11-03', ultimaCorrida: '2026-10-21', publicaciones: [post('U', '2026-11-01'), post('V', '2026-10-25')] })
    // Periodo de 90 días, pero solo se rastrearon 14 (21/10 → 03/11): 2 posts / 14 días × 7 = 1
    const m = metricasCompetidor([unica], CC, { periodo: { desde: '2026-08-06', hasta: '2026-11-03' } })
    expect(m.cadenciaSemanal).toBe(1)
  })

  it('el delta de seguidores no mezcla fuentes (IG redondea, Apify es exacto)', () => {
    const ig = corrida({ id: '2026-11-10-i', fecha: '2026-11-10', perfiles: [{ competidor: CC, seguidores: 11_000, fuente: 'ig' }] })
    expect(metricasCompetidor([c1, c2, ig], CC, { hoy: '2026-11-10' }).seguidores).toEqual({ actual: 11_000, delta: null })
  })

  it('con datos por publicación en el periodo, el legado no se suma (evita duplicar posts)', () => {
    const vieja = corrida({
      id: '2026-10-19-m',
      fecha: '2026-10-19',
      entradas: [{ id: '0123456789abcdef', corrida: '2026-10-19-m', marca: CC, fecha: '2026-10-18', movimiento: 'x', senal: 'nuevo', lectura: 'y', metricas: { likes: 400, posts: 4 } }],
    })
    const m = metricasCompetidor([vieja, c1], CC, { hoy: '2026-11-04' })
    expect(m.posts).toBe(2)
    expect(m.likes.total).toBe(130)
    expect(m.cobertura).toBe('completa')
  })

    it('sin datos: cobertura sin-datos y cifras vacías', () => {
    const m = metricasCompetidor([], CC, { hoy: '2026-11-04' })
    expect(m.cobertura).toBe('sin-datos')
    expect(m.posts).toBe(0)
    expect(m.er.promedio).toBeNull()
    expect(m.seguidores).toEqual({ actual: null, delta: null })
  })

  it('erDe: null sin seguidores o sin cifras', () => {
    expect(erDe({ likes: 10 }, null)).toBeNull()
    expect(erDe({}, 1000)).toBeNull()
    expect(erDe({ likes: 10, comentarios: 5 }, 1000)).toBe(1.5)
  })

  it('metricasMarca devuelve un elemento por competidor en el orden pedido', () => {
    expect(metricasMarca([c1], ['Otro', CC]).map((m) => m.competidor)).toEqual(['Otro', CC])
  })
})
