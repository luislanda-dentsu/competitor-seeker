import { describe, expect, it } from 'vitest'
import { erDe, metricasCompetidor, metricasMarca } from '../src/metricas.ts'
import { Corrida } from '../src/schemas/corrida.ts'

const CC = 'Country Club RD'

function corrida(over: Partial<Corrida> & Pick<Corrida, 'id' | 'fecha'>): Corrida {
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
    expect(m.likes.total).toBe(500)
    expect(m.likes.promedio).toBe(100) // solo la entrada con recuento de posts: 400/4
    expect(m.er.promedio).toBeNull()
    expect(m.publicaciones).toEqual([])
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
