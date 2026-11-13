import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { conLockCorrida, CorridaBloqueada, ejecutar, parsearArgs, rutaLockCorrida, SalidaTexto } from '../src/cli.ts'
import { guardarCorrida, leerCorrida, listarCorridas } from '../src/corridas.ts'
import { leerLog } from '../src/log.ts'
import type { Corrida } from '../src/schemas/corrida.ts'
import { crearMarca } from '../src/marcas.ts'
import { rutaLog, rutaMarca } from '../src/rutas.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

const e1 = { marca: 'Country Club RD', fecha: '2026-11-03', movimiento: 'Lanzó campaña', senal: 'nuevo', lectura: 'Se mueve' }
const resultadoOk = JSON.stringify({ entradas: [e1], verificado: true, intentos: 1, ig: { sesion: 'ok' } })

let repo: RepoTemporal
beforeEach(() => {
  repo = crearRepoTemporal()
  crearMarca({ nombre: 'Kola Real', slug: 'k', competidores: [{ nombre: 'Country Club RD' }] })
})
afterEach(() => repo.limpiar())

const registrar = (id: string, extra: string[] = [], entrada = resultadoOk) =>
  ejecutar(['registrar', '--marca', 'k', '--corrida-id', id, ...extra], { entrada }) as Promise<Record<string, unknown>>

describe('parsearArgs', () => {
  it('las banderas booleanas no consumen el token siguiente', () => {
    expect(parsearArgs(['registrar', '--pendiente', 'x', '--marca', 'k'])).toEqual({
      posicionales: ['registrar', 'x'],
      opciones: { pendiente: true, marca: 'k' },
    })
    expect(parsearArgs(['--pendiente']).opciones.pendiente).toBe(true)
    expect(parsearArgs(['--pendiente', 'true']).opciones.pendiente).toBe(true)
    expect(parsearArgs(['--pendiente=x']).opciones.pendiente).toBe(true)
    expect(parsearArgs(['--pendiente', 'false']).opciones.pendiente).toBeUndefined()
    expect(parsearArgs(['--pendiente=false']).opciones.pendiente).toBeUndefined()
    expect(parsearArgs(['--forzar', '--json', 'cmd']).opciones).toEqual({ forzar: true, json: true })
    // Las opciones con valor siguen consumiendo el siguiente token.
    expect(parsearArgs(['--marca', 'k', '--modo=ui']).opciones).toEqual({ marca: 'k', modo: 'ui' })
  })
})

describe('cs registrar', () => {
  it('registra; una corrida ya registrada no se vuelve a registrar', async () => {
    const r = await registrar('2026-11-03-0900-mac')
    expect(r).toMatchObject({ corridaId: '2026-11-03-0900-mac', estado: 'registrada', registradas: 1, duplicadas: [], entradas: 1 })
    expect(leerLog('k').items.length).toBe(1)
    expect(leerCorrida('k', '2026-11-03-0900-mac').estado).toBe('registrada')
    await expect(registrar('2026-11-03-0900-mac')).rejects.toThrow(/ya está en estado "registrada"/)
    expect(leerLog('k').items.length).toBe(1)
  })

  it('persiste publicaciones, perfiles y lecturas en corridas/<id>.json (no en el log)', async () => {
    const conDatos = JSON.stringify({
      ...JSON.parse(resultadoOk),
      publicaciones: [{ competidor: 'Country Club RD', url: 'https://www.instagram.com/p/A1/', fecha: '2026-11-02', formato: 'carrusel', likes: 50, comentarios: 3, fuente: 'apify' }],
      perfiles: [{ competidor: 'Country Club RD', seguidores: 1000, fuente: 'apify' }],
      lecturas: [{ competidor: 'Country Club RD', resumen: ['Carrusel de menú'] }],
    })
    await registrar('2026-11-03-0930-mac', [], conDatos)
    const c = leerCorrida('k', '2026-11-03-0930-mac')
    expect(c.publicaciones).toHaveLength(1)
    expect(c.perfiles?.[0]?.seguidores).toBe(1000)
    expect(c.lecturas?.[0]?.resumen).toEqual(['Carrusel de menú'])
    expect(JSON.stringify(leerLog('k').items)).not.toContain('instagram.com/p/A1')
  })

  it('una corrida histórica (ventana en el resultado) se registra como tal y no mueve ultima-corrida', async () => {
    await registrar('2026-11-01-0900-mac')
    const historica = JSON.stringify({
      entradas: [{ ...e1, fecha: '2025-12-10' }],
      verificado: true,
      intentos: 1,
      ig: { sesion: 'ok' },
      ventana: { desde: '2025-11-01', hasta: '2025-12-31' },
    })
    await registrar('2026-11-13-0900-mac', [], historica)
    const c = leerCorrida('k', '2026-11-13-0900-mac')
    expect(c.tipo).toBe('historica')
    expect(c.ventana).toEqual({ desde: '2025-11-01', hasta: '2025-12-31' })
    expect(await ejecutar(['ultima-corrida', 'k'])).toBe('2026-11-01')
    expect(await ejecutar(['ultima-corrida', 'k', '--fuente', 'ig'])).toBe('2026-11-01')
  })

  it('ultima-corrida --fuente ig ignora las corridas sin sesión de Instagram', async () => {
    const sinIg = JSON.stringify({ entradas: [e1], verificado: true, intentos: 1, ig: { sesion: 'no-disponible' } })
    await registrar('2026-11-01-0900-mac')
    await registrar('2026-11-03-0900-mac', [], sinIg)
    expect(await ejecutar(['ultima-corrida', 'k'])).toBe('2026-11-03')
    expect(await ejecutar(['ultima-corrida', 'k', '--fuente', 'ig'])).toBe('2026-11-01')
  })

  it('--pendiente x deja la corrida pendiente; solo `confirmar` la resuelve', async () => {
    const r = await registrar('2026-11-03-1000-mac', ['--pendiente', 'x'])
    expect(r).toMatchObject({ estado: 'pendiente-confirmacion', registradas: 0, entradas: 1 })
    expect(leerLog('k').items.length).toBe(0)
    await expect(registrar('2026-11-03-1000-mac')).rejects.toThrow(/pendiente-confirmacion.*cs confirmar/)
    await expect(registrar('2026-11-03-1000-mac', ['--forzar'])).rejects.toThrow(/pendiente-confirmacion/)

    const c = await ejecutar(['confirmar', '--marca', 'k', '--corrida-id', '2026-11-03-1000-mac', '--accion', 'registrar'])
    expect(c).toMatchObject({ estado: 'registrada', registradas: 1 })
    expect(leerLog('k').items.length).toBe(1)
  })

  it('una corrida descartada tampoco se re-registra; en-curso y error sí continúan', async () => {
    await registrar('2026-11-03-1100-mac', ['--pendiente'])
    await ejecutar(['confirmar', '--marca', 'k', '--corrida-id', '2026-11-03-1100-mac', '--accion', 'descartar'])
    await expect(registrar('2026-11-03-1100-mac')).rejects.toThrow(/"descartada"/)

    for (const estado of ['en-curso', 'error'] as const) {
      const id = `2026-11-03-1200-${estado}`
      guardarCorrida({
        id, marca: 'k', fecha: '2026-11-03', ultimaCorrida: null, inicio: '2026-11-03T12:00:00.000Z', estado, verificado: false,
        intentos: 0, objeciones: [], fuentes: [], competidores: [], entradas: [], modo: 'ui', maquina: 'h',
      })
      const r = await registrar(id)
      expect(r.estado).toBe('registrada')
      expect(leerCorrida('k', id).inicio).toBe('2026-11-03T12:00:00.000Z')
    }
  })

  it('sin marca.json falla sin crear carpetas', async () => {
    await expect(
      ejecutar(['registrar', '--marca', 'nadie', '--corrida-id', '2026-11-03-0900-mac'], { entrada: resultadoOk }),
    ).rejects.toThrow(/La marca "nadie" no existe/)
    expect(fs.existsSync(rutaMarca('nadie'))).toBe(false)
  })

  it('si el append al log falla, la corrida queda en error y no en registrada', async () => {
    fs.rmSync(rutaLog('k'))
    fs.mkdirSync(rutaLog('k')) // un directorio donde debería haber un archivo: appendJsonl revienta
    await expect(registrar('2026-11-03-1300-mac')).rejects.toThrow(/queda en estado "error"/)
    const c = leerCorrida('k', '2026-11-03-1300-mac')
    expect(c.estado).toBe('error')
    expect(c.error).toMatch(/No se pudo appendear al log/)
    expect(listarCorridas('k').corridas.filter((x) => x.estado === 'registrada')).toEqual([])
    // Reparado el log, la corrida en `error` puede continuar.
    fs.rmdirSync(rutaLog('k'))
    const r = await registrar('2026-11-03-1300-mac')
    expect(r.estado).toBe('registrada')
    expect(leerCorrida('k', '2026-11-03-1300-mac').error).toBeUndefined()
  })
})

describe('cs help', () => {
  it('sin comando, `help` y `--help` devuelven la ayuda', async () => {
    for (const argv of [[], ['help'], ['--help'], ['registrar', '--help']]) {
      const s = await ejecutar(argv)
      expect(s).toBeInstanceOf(SalidaTexto)
      expect((s as SalidaTexto).texto).toMatch(/^Uso: scripts\/cs <comando>/)
    }
    await expect(ejecutar(['nada'])).rejects.toThrow(/Comando desconocido: nada/)
  })

  it('scripts/cs --help imprime la ayuda y sale con 0', () => {
    const cli = path.join(import.meta.dirname, '../src/cli.ts')
    const r = spawnSync('npx', ['tsx', cli, '--help'], { encoding: 'utf8', env: { ...process.env, CS_REPO_ROOT: repo.raiz } })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/^Uso: scripts\/cs <comando>/)
    expect(r.stderr).toBe('')
  })
})

const entrada = { marca: 'Coca Cola RD', fecha: '2026-11-03', movimiento: "Campaña 'Destapa la Navidad' con influencers", senal: 'nuevo', lectura: "Apuesta por el 'tono festivo' temprano" }
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v), 'utf8').toString('base64')

function pendiente(id: string): Corrida {
  return {
    id, marca: 'k', fecha: '2026-11-03', ultimaCorrida: null, inicio: '2026-11-03T10:00:00.000Z', estado: 'pendiente-confirmacion',
    verificado: false, intentos: 3, objeciones: [{ marca: 'A', problema: 'sin evidencia' }], fuentes: ['web'], competidores: [],
    entradas: [{ ...entrada, senal: 'nuevo', id: '0123456789abcdef', corrida: id }], modo: 'ui', maquina: 'h',
  }
}

describe('cli', () => {
  it('parsearArgs acepta --json-b64 como valor y como --json-b64=valor', () => {
    expect(parsearArgs(['registrar', '--marca', 'k', '--json-b64', 'eyJhIjoxfQ==', '--pendiente']).opciones).toEqual({ marca: 'k', 'json-b64': 'eyJhIjoxfQ==', pendiente: true })
    expect(parsearArgs(['registrar', '--json-b64=eyJhIjoxfQ=='])).toEqual({ posicionales: ['registrar'], opciones: { 'json-b64': 'eyJhIjoxfQ==' } })
  })

  it('registrar --json-b64 registra un JSON con apóstrofos sin pasar por stdin', async () => {
    const id = '2026-11-03-1000-k-mac'
    const r = (await ejecutar(['registrar', '--marca', 'k', '--corrida-id', id, '--modo', 'ui', '--json-b64', b64({ entradas: [entrada], verificado: true, intentos: 1 })])) as { estado: string; registradas: number }
    expect(r.estado).toBe('registrada')
    expect(r.registradas).toBe(1)
    const log = leerLog('k').items
    expect(log[0]?.movimiento).toBe("Campaña 'Destapa la Navidad' con influencers")
    expect(leerCorrida('k', id).estado).toBe('registrada')
    expect(fs.existsSync(rutaLockCorrida('k', id))).toBe(false)
  })

  it('registrar rechaza --json-b64 vacío o no base64', async () => {
    await expect(ejecutar(['registrar', '--marca', 'k', '--corrida-id', 'c', '--json-b64'])).rejects.toThrow(/json-b64/)
    await expect(ejecutar(['registrar', '--marca', 'k', '--corrida-id', 'c', '--json-b64', '%%%'])).rejects.toThrow(/base64/)
  })

  it('confirmar toma el lock por corrida: una segunda confirmación concurrente falla y el lock se libera siempre', async () => {
    const id = 'c-pendiente'
    guardarCorrida(pendiente(id))
    const lock = rutaLockCorrida('k', id)

    // Lock ajeno presente: no se confirma ni se toca el log.
    fs.writeFileSync(lock, '999 x\n', { flag: 'wx' })
    await expect(ejecutar(['confirmar', '--marca', 'k', '--corrida-id', id, '--accion', 'registrar'])).rejects.toThrow(CorridaBloqueada)
    expect(leerCorrida('k', id).estado).toBe('pendiente-confirmacion')
    expect(leerLog('k').items).toHaveLength(0)
    fs.rmSync(lock)

    // Dos confirmaciones en paralelo: solo una entra; la otra ve el lock o el estado ya cambiado.
    const [a, b] = await Promise.allSettled([
      ejecutar(['confirmar', '--marca', 'k', '--corrida-id', id, '--accion', 'registrar']),
      ejecutar(['confirmar', '--marca', 'k', '--corrida-id', id, '--accion', 'registrar']),
    ])
    expect([a.status, b.status].filter((s) => s === 'fulfilled')).toHaveLength(1)
    expect(leerLog('k').items).toHaveLength(1)
    expect(leerCorrida('k', id).estado).toBe('registrada')
    expect(fs.existsSync(lock)).toBe(false)

    // El lock se libera aunque fn lance.
    await expect(conLockCorrida('k', id, () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(fs.existsSync(lock)).toBe(false)
  })
})

describe('registrar --desde-workflow', () => {
  it('lee el .result del archivo de salida del workflow (apóstrofos incluidos)', async () => {
    const salida = path.join(repo.raiz, 'wf.output')
    fs.writeFileSync(salida, JSON.stringify({ summary: 'x', logs: [], result: { entradas: [entrada], verificado: true, intentos: 1 } }))
    const id = '2026-11-04-1206-k-mac'
    const r = (await ejecutar(['registrar', '--marca', 'k', '--corrida-id', id, '--modo', 'ui', '--desde-workflow', salida])) as { estado: string; registradas: number }
    expect(r).toMatchObject({ estado: 'registrada', registradas: 1 })
    expect(leerLog('k').items[0]?.movimiento).toContain("'Destapa la Navidad'")
  })

  it('no lee archivos fuera del directorio temporal ni filtra su contenido', async () => {
    const env = path.join(process.cwd(), 'package.json')
    await expect(ejecutar(['registrar', '--marca', 'k', '--corrida-id', 'c', '--desde-workflow', env])).rejects.toThrow(/solo acepta/)
    const noJson = path.join(repo.raiz, 'wf2.output')
    fs.writeFileSync(noJson, 'AUTH_SECRET=supersecreto')
    await expect(ejecutar(['registrar', '--marca', 'k', '--corrida-id', 'c', '--desde-workflow', noJson])).rejects.toThrow(/^(?!.*supersecreto).*no es JSON válido/)
  })

  it('archivo inexistente → error claro', async () => {
    await expect(ejecutar(['registrar', '--marca', 'k', '--corrida-id', 'c', '--desde-workflow', '/no/existe.output'])).rejects.toThrow(/salida del workflow/)
  })
})
