// Ejecuta `.claude/workflows/corrida.js` con agentes simulados y valida que lo
// que devuelve pasa tal cual por `ResultadoWorkflow` (lo que lee `cs registrar`).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ResultadoWorkflow } from '../src/schemas/corrida.ts'

const RUTA_WORKFLOW = path.join(import.meta.dirname, '../../../.claude/workflows/corrida.js')

interface OpcionesAgente {
  label: string
  phase: string
  agentType: string
  schema?: unknown
}

type Agente = (prompt: string, o: OpcionesAgente) => Promise<unknown>

/** Carga el script como cuerpo de una función async con los globals del runtime de workflows. */
async function correrWorkflow(args: unknown, agente: Agente): Promise<Record<string, unknown>> {
  const fuente = fs.readFileSync(RUTA_WORKFLOW, 'utf8').replace(/^export const meta/m, 'const meta')
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
    ...p: string[]
  ) => (...a: unknown[]) => Promise<unknown>
  const fn = new AsyncFunction('args', 'agent', 'phase', 'log', 'parallel', fuente)
  const parallel = (tareas: (() => Promise<unknown>)[]) => Promise.all(tareas.map((t) => t()))
  return (await fn(args, agente, () => {}, () => {}, parallel)) as Record<string, unknown>
}

const ENTRADAS = [
  { marca: 'Country Club RD', fecha: '2026-11-03', movimiento: 'Lanzó campaña', senal: 'nuevo', lectura: 'Se mueve' },
  { marca: 'Coca Cola RD', fecha: '2026-11-03', movimiento: 'Sin rastro', senal: 'sin-datos', lectura: 'Nada' },
]

const LECTURAS = [
  {
    competidor: 'Country Club RD',
    resumen: ['Reel de torneo con mayor tracción'],
    estrategia: {
      hipotesis: ['Empuja eventos deportivos'],
      pilares: ['Eventos'],
      formatosYCadencia: 'Reels, 2 por semana',
      implicaciones: ['Vigilar su calendario de eventos'],
      confianza: 'media',
      postsCitados: ['https://www.instagram.com/reel/ABC123/'],
    },
  },
]

function agenteFalso(veredicto: (intento: number) => { valido: boolean; objeciones: { marca: string; problema: string }[] }): Agente {
  let intento = 0
  return async (_prompt, o) => {
    switch (o.agentType) {
      case 'rastreador-ig':
        return {
          hallazgos: 'Hallazgos de Instagram: 3 posts nuevos',
          publicaciones: [
            { competidor: 'Country Club RD', url: 'https://www.instagram.com/reel/ABC123/', fecha: '2026-11-01', formato: 'reel', tema: 'Torneo', likes: 90 },
            { competidor: 'Country Club RD', url: 'https://www.instagram.com/p/XYZ/', fecha: '2026-10-30', formato: 'imagen', likes: 10 },
          ],
          perfiles: [{ competidor: 'Country Club RD', seguidores: 9000, publicacionesTotales: 400 }],
        }
      case 'rastreador-apify':
        return {
          hallazgos: 'Apify: 24 posts con métricas',
          resultados: 24,
          runId: 'run-apify-1',
          publicaciones: [
            { competidor: 'Country Club RD', url: 'https://www.instagram.com/countryclubrd/p/ABC123/?img=1', fecha: '2026-11-01', formato: 'reel', likes: 100, comentarios: 5, vistas: 2000 },
          ],
          perfiles: [{ competidor: 'Country Club RD', seguidores: 9120 }],
        }
      case 'rastreador':
        return 'Hallazgos web: nota de prensa'
      case 'analista':
        return { entradas: ENTRADAS, lecturas: LECTURAS }
      case 'verificador':
        return veredicto(++intento)
      default:
        throw new Error(`agentType inesperado: ${o.agentType}`)
    }
  }
}

describe('workflow corrida.js ↔ ResultadoWorkflow', () => {
  it('éxito con IG y Apify incluidos: el JSON pasa el schema y no lleva nulls', async () => {
    const salida = await correrWorkflow(
      {
        marca: 'kolareal',
        fechaCorrida: '2026-11-03',
        ultimaCorrida: '2026-08-20',
        corridaId: '2026-11-03-0900-mac',
        apify: { habilitado: true, resultsLimit: 12 },
        competidores: [
          { nombre: 'Country Club RD', url: 'https://www.instagram.com/countryclubrd/' },
          { nombre: 'Coca Cola RD', url: 'https://www.instagram.com/cocacolard/' },
        ],
      },
      agenteFalso(() => ({ valido: true, objeciones: [] })),
    )
    expect(salida.verificado).toBe(true)
    expect(salida.intentos).toBe(1)
    expect(salida.apify).toEqual({ incluido: true, omitido: false, resultados: 24, costeEstimadoUsd: 0.0648, runId: 'run-apify-1' })
    expect(salida.ig).toEqual({ sesion: 'ok' })
    expect(JSON.stringify(salida)).not.toContain('null')

    // Exactamente el objeto que devuelve el workflow, tras pasar por JSON (stdin).
    const parse = ResultadoWorkflow.safeParse(JSON.parse(JSON.stringify(salida)))
    expect(parse.success).toBe(true)
    expect(parse.data?.apify?.runId).toBe('run-apify-1')
    expect(parse.data?.apify?.motivo).toBeUndefined()
    expect(parse.data?.entradas.length).toBe(2)
    expect(parse.data?.lecturas).toEqual(LECTURAS)
  })

  it('consolida publicaciones por shortcode (Apify gana en cifras) y perfiles (Apify gana en seguidores)', async () => {
    const salida = await correrWorkflow(
      {
        marca: 'kolareal',
        fechaCorrida: '2026-11-03',
        ultimaCorrida: '2026-10-20',
        apify: { habilitado: true, resultsLimit: 12 },
        competidores: [{ nombre: 'Country Club RD', url: 'https://www.instagram.com/countryclubrd/' }],
      },
      agenteFalso(() => ({ valido: true, objeciones: [] })),
    )
    const parse = ResultadoWorkflow.parse(JSON.parse(JSON.stringify(salida)))
    expect(parse.publicaciones).toHaveLength(2)
    const reel = parse.publicaciones!.find((p) => p.url.includes('ABC123'))!
    expect(reel).toMatchObject({ likes: 100, comentarios: 5, vistas: 2000, tema: 'Torneo', fuente: 'apify', fecha: '2026-11-01' })
    expect(parse.publicaciones![0]!.fecha).toBe('2026-11-01') // más reciente primero
    expect(parse.perfiles).toEqual([{ competidor: 'Country Club RD', seguidores: 9120, publicacionesTotales: 400, fuente: 'apify' }])
  })

  it('descarta publicaciones inválidas sin tumbar el resultado', () => {
    const r = ResultadoWorkflow.safeParse({
      entradas: ENTRADAS,
      verificado: true,
      publicaciones: [
        { competidor: 'X', url: 'no-es-url', fecha: '2026-11-01', formato: 'reel', fuente: 'ig' },
        { competidor: 'X', url: 'https://www.instagram.com/p/OK/', fecha: '2026-11-01', formato: 'reel', fuente: 'ig' },
      ],
    })
    expect(r.success).toBe(true)
    expect(r.data?.publicaciones).toHaveLength(1)
  })

  it('fallo tras 3 intentos sin IG ni Apify: sesion no-usado y motivo string, sin nulls', async () => {
    const salida = await correrWorkflow(
      {
        marca: 'kolareal',
        fechaCorrida: '2026-11-03',
        ultimaCorrida: null,
        competidores: [{ nombre: 'Country Club RD', url: 'https://countryclub.do' }, { nombre: 'Coca Cola RD' }],
      },
      agenteFalso(() => ({ valido: false, objeciones: [{ marca: 'Coca Cola RD', problema: 'No hay evidencia' }] })),
    )
    expect(salida.verificado).toBe(false)
    expect(salida.intentos).toBe(3)
    expect(salida.corridaId).toBe('2026-11-03-sin-id')
    expect(salida.ig).toEqual({ sesion: 'no-usado' })
    expect(salida.apify).toEqual({ incluido: false, omitido: true, resultados: 0, costeEstimadoUsd: 0, motivo: 'no indicado por el orquestador' })
    expect(JSON.stringify(salida)).not.toContain('null')

    const parse = ResultadoWorkflow.safeParse(JSON.parse(JSON.stringify(salida)))
    expect(parse.success).toBe(true)
    expect(parse.data?.objeciones).toEqual([{ marca: 'Coca Cola RD', problema: 'No hay evidencia' }])
    expect(parse.data?.ig?.sesion).toBe('no-usado')
  })

  it('apify deshabilitado sin motivo: el campo se omite (nunca null)', async () => {
    const salida = await correrWorkflow(
      {
        marca: 'kolareal',
        fechaCorrida: '2026-11-03',
        ultimaCorrida: null,
        apify: { habilitado: false },
        competidores: [{ nombre: 'Country Club RD', url: 'https://www.instagram.com/countryclubrd/' }],
      },
      agenteFalso(() => ({ valido: true, objeciones: [] })),
    )
    expect(salida.apify).toEqual({ incluido: false, omitido: true, resultados: 0, costeEstimadoUsd: 0 })
    expect('motivo' in (salida.apify as object)).toBe(false)
    expect(ResultadoWorkflow.safeParse(JSON.parse(JSON.stringify(salida))).success).toBe(true)
  })

  it('el schema tolera además motivo/runId null y sesion error (compatibilidad con JSON viejo)', () => {
    const r = ResultadoWorkflow.safeParse({
      entradas: ENTRADAS,
      verificado: false,
      intentos: 3,
      apify: { incluido: false, resultados: 0, costeEstimadoUsd: 0, runId: null, motivo: null },
      ig: { sesion: 'error' },
    })
    expect(r.success).toBe(true)
    expect(r.data?.ig?.sesion).toBe('error')
  })
})

describe('ventana de Apify', () => {
  async function promptApify(fechaCorrida: string, ultimaCorrida: string | null): Promise<string> {
    let capturado = ''
    const base = agenteFalso(() => ({ valido: true, objeciones: [] }))
    await correrWorkflow(
      {
        marca: 'k', fechaCorrida, ultimaCorrida, corridaId: 'c1',
        apify: { habilitado: true, resultsLimit: 12 },
        competidores: [{ nombre: 'A', url: 'https://www.instagram.com/a/' }],
      },
      async (prompt, o) => {
        if (o.agentType === 'rastreador-apify') capturado = prompt
        return base(prompt, o)
      },
    )
    return capturado
  }

  it('con una corrida del mismo día pide al menos los últimos 14 días', async () => {
    expect(await promptApify('2026-11-04', '2026-11-04')).toContain('onlyPostsNewerThan: 2026-10-21')
  })

  it('si la última corrida es más antigua que 14 días, usa esa fecha', async () => {
    expect(await promptApify('2026-11-04', '2026-08-20')).toContain('onlyPostsNewerThan: 2026-08-20')
  })

  it('sin corrida previa usa los últimos 14 días', async () => {
    expect(await promptApify('2026-11-04', null)).toContain('onlyPostsNewerThan: 2026-10-21')
  })
})

describe('regresión corrida 2026-11-04 16:03 (parval)', () => {
  const competidores = [
    { nombre: 'United Capital', url: 'https://www.instagram.com/unitedcapitaldr/' },
    { nombre: 'Interval', url: 'https://www.instagram.com/interval.rd/' },
  ]
  const UC = 'https://www.instagram.com/unitedcapitaldr/p/DfTRo7pG58D/'
  const IN = 'https://www.instagram.com/interval.rd/p/DfU6x4KoIRF/'

  function agente(prompts: Record<string, string>): Agente {
    return async (prompt, o) => {
      prompts[o.agentType] = prompt
      switch (o.agentType) {
        case 'rastreador-ig':
          return {
            hallazgos: 'bloques IG',
            publicaciones: [
              { competidor: 'United Capital', url: UC, fechaHora: '2026-11-04T01:27:00.000Z', fecha: '2026-11-04', formato: 'carrusel' },
              { competidor: 'Interval', url: IN, fechaHora: '2026-11-04T14:00:00.000Z', fecha: '2026-11-04', formato: 'carrusel', likes: 98, comentarios: 4 },
            ],
            perfiles: [],
          }
        case 'rastreador':
          return 'web'
        case 'analista':
          return {
            entradas: [
              { marca: 'Interval', fecha: '2026-11-04', movimiento: 'Carrusel', senal: 'nuevo', lectura: 'x', fuentes: ['ig', 'apify'] },
              { marca: 'United Capital', fecha: '2026-11-03', movimiento: 'Carrusel', senal: 'nuevo', lectura: 'x', fuentes: ['apify'] },
            ],
            lecturas: [
              {
                competidor: 'United Capital',
                resumen: ['Carrusel'],
                estrategia: { hipotesis: ['h'], pilares: [], formatosYCadencia: 'c', implicaciones: [], confianza: 'baja', postsCitados: [UC, IN, 'https://unitedcapital.com.do/nota'] },
              },
            ],
          }
        case 'verificador':
          return { valido: true, objeciones: [] }
        default:
          throw new Error(o.agentType)
      }
    }
  }

  it('fecha local, ventana de IG, fuentes saneadas y postsCitados solo propios', async () => {
    const prompts: Record<string, string> = {}
    const salida = await correrWorkflow(
      {
        marca: 'parval',
        fechaCorrida: '2026-11-04',
        ultimaCorrida: '2026-11-04',
        ultimaCorridaIg: null,
        apify: { habilitado: false, motivo: 'desactivado por la usuaria' },
        competidores,
      },
      agente(prompts),
    )
    const r = ResultadoWorkflow.parse(JSON.parse(JSON.stringify(salida)))
    // 01:27Z del 4/11 es la noche del 3/11 en RD.
    expect(r.publicaciones!.find((p) => p.url === UC)!.fecha).toBe('2026-11-03')
    expect(r.publicaciones!.find((p) => p.url === IN)!.fecha).toBe('2026-11-04')
    expect(JSON.stringify(r.publicaciones)).not.toContain('fechaHora')
    // Apify apagado: nunca "apify" en fuentes.
    expect(r.entradas.map((e) => e.fuentes)).toEqual([['ig'], ['web']])
    // Un post de Interval no sustenta la estrategia de United Capital.
    expect(r.lecturas![0]!.estrategia!.postsCitados).toEqual([UC, 'https://unitedcapital.com.do/nota'])
    // IG sin corrida previa inspeccionada: ventana de ~4 semanas, no "desde el 4/11".
    expect(prompts['rastreador-ig']).toContain('sin corrida previa con Instagram inspeccionado')
    expect(prompts['analista']).toContain('Canales que corrieron en esta corrida (el campo "fuentes" solo puede usar estos): web, ig')
    expect(prompts['analista']).toContain('Instagram → fecha ≥ inicio de la ventana')
    expect(prompts['verificador']).toContain('ya están en hora local')
  })
})
