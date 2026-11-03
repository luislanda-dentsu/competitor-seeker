import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ejecutar, parsearArgs, SalidaTexto } from '../src/cli.ts'
import { guardarCorrida, leerCorrida, listarCorridas } from '../src/corridas.ts'
import { leerLog } from '../src/log.ts'
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
