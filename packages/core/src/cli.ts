// CLI `scripts/cs`: único escritor de log.jsonl y corridas/*.json desde el
// orquestador. Salida JSON por stdout; errores por stderr con exit 1.
import os from 'node:os'
import { consultarLimites } from './apify/limites.ts'
import { calcularUso, decidirApify } from './apify/uso.ts'
import { leerConfig, leerSecrets } from './config.ts'
import { existeCorrida, fechaLocal, guardarCorrida, leerCorrida, listarCorridas, nuevoIdCorrida, ultimaCorridaRegistrada } from './corridas.ts'
import { describirErrorZod } from './jsonl.ts'
import { conId, registrarEntradas } from './log.ts'
import { competidoresActivos, crearMarca, existeMarca, leerMarca, listarMarcas } from './marcas.ts'
import { migrarMarca } from './migracion.ts'
import { Corrida, ResultadoWorkflow, type EstadoCorrida } from './schemas/corrida.ts'
import type { Fuente } from './schemas/entrada.ts'

export interface ArgsCli {
  posicionales: string[]
  opciones: Record<string, string | true>
}

/** `--clave valor`, `--clave=valor` o `--bandera`. */
export function parsearArgs(argv: readonly string[]): ArgsCli {
  const posicionales: string[] = []
  const opciones: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!a.startsWith('--')) {
      posicionales.push(a)
      continue
    }
    const cuerpo = a.slice(2)
    const igual = cuerpo.indexOf('=')
    if (igual >= 0) {
      opciones[cuerpo.slice(0, igual)] = cuerpo.slice(igual + 1)
      continue
    }
    const siguiente = argv[i + 1]
    if (siguiente !== undefined && !siguiente.startsWith('--')) {
      opciones[cuerpo] = siguiente
      i++
    } else opciones[cuerpo] = true
  }
  return { posicionales, opciones }
}

function requerir(opciones: ArgsCli['opciones'], clave: string): string {
  const v = opciones[clave]
  if (typeof v !== 'string' || v === '') throw new Error(`Falta --${clave}`)
  return v
}

async function leerStdin(): Promise<string> {
  const trozos: Buffer[] = []
  for await (const chunk of process.stdin) trozos.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(trozos).toString('utf8')
}

function fuentesDe(r: ResultadoWorkflow): Fuente[] {
  if (r.fuentes?.length) return [...new Set(r.fuentes)]
  const f: Fuente[] = ['web']
  if (r.ig?.sesion === 'ok') f.push('ig')
  if ((r.apify?.resultados ?? 0) > 0) f.push('apify')
  return f
}

async function cmdRegistrar(a: ArgsCli): Promise<unknown> {
  const marca = requerir(a.opciones, 'marca')
  const corridaId = requerir(a.opciones, 'corrida-id')
  const pendiente = a.opciones.pendiente === true
  const forzar = a.opciones.forzar === true
  const modo = a.opciones.modo === 'ui' ? 'ui' : 'terminal'
  if (a.opciones.modo && a.opciones.modo !== 'ui' && a.opciones.modo !== 'terminal') throw new Error('--modo debe ser ui|terminal')

  const texto = await leerStdin()
  if (texto.trim() === '') throw new Error('Se esperaba por stdin el JSON {entradas, verificado, intentos, ...} del workflow')
  const parse = ResultadoWorkflow.safeParse(JSON.parse(texto))
  if (!parse.success) throw new Error(`JSON de stdin inválido: ${describirErrorZod(parse.error)}`)
  const r = parse.data

  const previa = existeCorrida(marca, corridaId) ? leerCorrida(marca, corridaId) : null
  if (previa && previa.estado === 'registrada') {
    throw new Error(`La corrida ${corridaId} ya está registrada; no se sobrescribe. Usa otro --corrida-id`)
  }
  const estado: EstadoCorrida = pendiente || (!r.verificado && !forzar) ? 'pendiente-confirmacion' : 'registrada'
  const ahora = new Date()
  const inicio = previa?.inicio ?? ahora.toISOString()
  const fechaId = /^\d{4}-\d{2}-\d{2}/.exec(corridaId)?.[0]
  const competidores = existeMarca(marca)
    ? competidoresActivos(leerMarca(marca)).map((c) => c.nombre)
    : [...new Set(r.entradas.map((e) => e.marca))]

  const corrida: Corrida = Corrida.parse({
    ...(previa ?? {}),
    id: corridaId,
    marca,
    fecha: previa?.fecha ?? fechaId ?? fechaLocal(ahora),
    ultimaCorrida: previa?.ultimaCorrida ?? ultimaCorridaRegistrada(marca),
    inicio,
    fin: ahora.toISOString(),
    duracionMs: Math.max(0, ahora.getTime() - Date.parse(inicio)),
    estado,
    verificado: r.verificado,
    intentos: r.intentos,
    objeciones: r.objeciones ?? [],
    fuentes: fuentesDe(r),
    ...(r.apify ? { apify: r.apify } : {}),
    competidores,
    entradas: r.entradas.map((e) => conId(e, corridaId)),
    modo: previa?.modo ?? modo,
    maquina: previa?.maquina ?? os.hostname(),
    ...(r.sessionId ? { sessionId: r.sessionId } : {}),
    ...(r.ig ? { ig: r.ig } : {}),
  })
  guardarCorrida(corrida)

  if (estado !== 'registrada') {
    return { corridaId, estado, registradas: 0, duplicadas: [], entradas: r.entradas.length, objeciones: corrida.objeciones }
  }
  const res = registrarEntradas(marca, corridaId, r.entradas)
  return { corridaId, estado, registradas: res.registradas, duplicadas: res.duplicadas, entradas: r.entradas.length }
}

function cmdConfirmar(a: ArgsCli): unknown {
  const marca = requerir(a.opciones, 'marca')
  const corridaId = requerir(a.opciones, 'corrida-id')
  const accion = requerir(a.opciones, 'accion')
  if (accion !== 'registrar' && accion !== 'descartar') throw new Error('--accion debe ser registrar|descartar')
  const corrida = leerCorrida(marca, corridaId)
  if (corrida.estado !== 'pendiente-confirmacion') {
    throw new Error(`La corrida ${corridaId} está en estado "${corrida.estado}", no pendiente-confirmacion`)
  }
  if (accion === 'descartar') {
    guardarCorrida({ ...corrida, estado: 'descartada' })
    return { corridaId, estado: 'descartada', registradas: 0, duplicadas: [] }
  }
  const res = registrarEntradas(marca, corridaId, corrida.entradas)
  guardarCorrida({ ...corrida, estado: 'registrada' })
  return { corridaId, estado: 'registrada', registradas: res.registradas, duplicadas: res.duplicadas }
}

async function cmdApifyUso(): Promise<unknown> {
  const cfg = leerConfig().apify
  const token = leerSecrets().apifyToken
  if (!token) return { configurado: false, habilitado: false, motivo: 'sin token', resultsLimit: cfg.resultsLimitPorPerfil }
  const limites = await consultarLimites(token)
  const corridas = listarMarcas().flatMap((m) => listarCorridas(m.slug).corridas)
  const uso = calcularUso(limites, cfg, corridas)
  const decision = decidirApify(uso, cfg)
  return { configurado: true, ...uso, ...decision }
}

function cmdMarca(a: ArgsCli): unknown {
  const sub = a.posicionales[1]
  if (sub === 'listar') return listarMarcas()
  if (sub === 'crear') {
    const nombre = requerir(a.opciones, 'nombre')
    const competidores = typeof a.opciones.competidores === 'string'
      ? a.opciones.competidores.split(';').map((l) => l.trim()).filter(Boolean).map((l) => {
          const [n = '', u] = l.split('|').map((p) => p.trim())
          return u ? { nombre: n, url: u } : { nombre: n }
        })
      : []
    return crearMarca({ nombre, competidores })
  }
  throw new Error('Uso: cs marca listar | cs marca crear --nombre X [--competidores "Nombre | URL; ..."]')
}

const AYUDA = `Uso: scripts/cs <comando>
  registrar --marca <slug> --corrida-id <id> [--pendiente] [--forzar] [--modo ui|terminal]   (JSON del workflow por stdin)
  confirmar --marca <slug> --corrida-id <id> --accion registrar|descartar
  migrar <slug>
  ultima-corrida <slug>
  nuevo-id <slug>
  marca listar | marca crear --nombre X [--competidores "Nombre | URL; ..."]
  apify-uso [--json]
  config leer`

export async function ejecutar(argv: readonly string[]): Promise<unknown> {
  const a = parsearArgs(argv)
  const cmd = a.posicionales[0]
  const slug = () => {
    const s = a.posicionales[1]
    if (!s) throw new Error(`Falta el slug de la marca.\n${AYUDA}`)
    return s
  }
  switch (cmd) {
    case 'registrar':
      return cmdRegistrar(a)
    case 'confirmar':
      return cmdConfirmar(a)
    case 'migrar':
      return migrarMarca(slug())
    case 'ultima-corrida':
      return ultimaCorridaRegistrada(slug())
    case 'nuevo-id':
      return nuevoIdCorrida(slug())
    case 'marca':
      return cmdMarca(a)
    case 'apify-uso':
      return cmdApifyUso()
    case 'config':
      if (a.posicionales[1] === 'leer') return leerConfig()
      throw new Error('Uso: cs config leer')
    default:
      throw new Error(`Comando desconocido: ${cmd ?? '(ninguno)'}\n${AYUDA}`)
  }
}

async function main(): Promise<void> {
  try {
    const salida = await ejecutar(process.argv.slice(2))
    process.stdout.write(JSON.stringify(salida ?? null, null, 2) + '\n')
  } catch (e) {
    process.stderr.write(`cs: ${(e as Error).message}\n`)
    process.exitCode = 1
  }
}

const esEntrada = process.argv[1] !== undefined && /[\\/]cli\.ts$/.test(process.argv[1])
if (esEntrada) void main()
