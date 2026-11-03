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

/** Banderas booleanas conocidas: nunca toman el token siguiente como valor. */
export const BANDERAS = new Set(['pendiente', 'forzar', 'json', 'help'])

const PALABRAS_FALSAS = new Set(['false', '0', 'no', 'off'])
const PALABRAS_BOOLEANAS = new Set([...PALABRAS_FALSAS, 'true', '1', 'yes', 'on'])

/**
 * `--clave valor`, `--clave=valor` o `--bandera`. Una bandera de `BANDERAS`
 * vale `true` salvo que lleve un literal falso (`--pendiente=false`,
 * `--pendiente false`), en cuyo caso queda ausente; cualquier otro token tras
 * ella (`--pendiente x`) no se consume y pasa a posicionales.
 */
export function parsearArgs(argv: readonly string[]): ArgsCli {
  const posicionales: string[] = []
  const opciones: Record<string, string | true> = {}
  const fijarBandera = (clave: string, valor: string | undefined) => {
    if (valor !== undefined && PALABRAS_FALSAS.has(valor.trim().toLowerCase())) delete opciones[clave]
    else opciones[clave] = true
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!a.startsWith('--')) {
      posicionales.push(a)
      continue
    }
    const cuerpo = a.slice(2)
    const igual = cuerpo.indexOf('=')
    if (igual >= 0) {
      const clave = cuerpo.slice(0, igual)
      if (BANDERAS.has(clave)) fijarBandera(clave, cuerpo.slice(igual + 1))
      else opciones[clave] = cuerpo.slice(igual + 1)
      continue
    }
    const siguiente = argv[i + 1]
    if (BANDERAS.has(cuerpo)) {
      // Solo un literal booleano se consume (`--pendiente false`); `--pendiente x` deja `x` como posicional.
      if (siguiente !== undefined && PALABRAS_BOOLEANAS.has(siguiente.trim().toLowerCase())) {
        fijarBandera(cuerpo, siguiente)
        i++
      } else fijarBandera(cuerpo, undefined)
      continue
    }
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

/** Estados desde los que `registrar` puede continuar una corrida ya guardada. */
const ESTADOS_REGISTRABLES: readonly EstadoCorrida[] = ['en-curso', 'error']

export interface OpcionesEjecucion {
  /** Texto que sustituye a stdin (tests). */
  entrada?: string
}

async function cmdRegistrar(a: ArgsCli, op: OpcionesEjecucion): Promise<unknown> {
  const marca = requerir(a.opciones, 'marca')
  const corridaId = requerir(a.opciones, 'corrida-id')
  const pendiente = a.opciones.pendiente === true
  const forzar = a.opciones.forzar === true
  const modo = a.opciones.modo === 'ui' ? 'ui' : 'terminal'
  if (a.opciones.modo && a.opciones.modo !== 'ui' && a.opciones.modo !== 'terminal') throw new Error('--modo debe ser ui|terminal')

  // La marca debe existir (marca.json): registrar nunca da de alta carpetas.
  if (!existeMarca(marca)) {
    throw new Error(`La marca "${marca}" no existe (falta marcas/${marca}/marca.json); créala con \`cs marca crear\` o migra con \`cs migrar\``)
  }

  const texto = op.entrada ?? (await leerStdin())
  if (texto.trim() === '') throw new Error('Se esperaba por stdin el JSON {entradas, verificado, intentos, ...} del workflow')
  const parse = ResultadoWorkflow.safeParse(JSON.parse(texto))
  if (!parse.success) throw new Error(`JSON de stdin inválido: ${describirErrorZod(parse.error)}`)
  const r = parse.data

  const previa = existeCorrida(marca, corridaId) ? leerCorrida(marca, corridaId) : null
  if (previa && !ESTADOS_REGISTRABLES.includes(previa.estado)) {
    const pista = previa.estado === 'pendiente-confirmacion'
      ? 'resuélvela con `cs confirmar --accion registrar|descartar`'
      : 'usa otro --corrida-id'
    throw new Error(`La corrida ${corridaId} ya está en estado "${previa.estado}"; no se sobrescribe: ${pista}`)
  }
  const estado: EstadoCorrida = pendiente || (!r.verificado && !forzar) ? 'pendiente-confirmacion' : 'registrada'
  const ahora = new Date()
  const inicio = previa?.inicio ?? ahora.toISOString()
  const fechaId = /^\d{4}-\d{2}-\d{2}/.exec(corridaId)?.[0]
  const competidores = competidoresActivos(leerMarca(marca)).map((c) => c.nombre)

  // Al continuar una corrida en `error` se descarta el mensaje viejo.
  const { error: _errorPrevio, ...basePrevia } = previa ?? {}
  const corrida: Corrida = Corrida.parse({
    ...basePrevia,
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

  if (estado !== 'registrada') {
    guardarCorrida(corrida)
    return { corridaId, estado, registradas: 0, duplicadas: [], entradas: r.entradas.length, objeciones: corrida.objeciones }
  }
  // Primero el append al log; la corrida se marca `registrada` solo si el append
  // terminó. Si falla, queda en `error` con el mensaje para poder reintentar.
  let res: ReturnType<typeof registrarEntradas>
  try {
    res = registrarEntradas(marca, corridaId, r.entradas)
  } catch (e) {
    const mensaje = (e as Error).message
    guardarCorrida({ ...corrida, estado: 'error', error: `No se pudo appendear al log: ${mensaje}` })
    throw new Error(`No se pudo appendear al log de ${marca}; la corrida ${corridaId} queda en estado "error": ${mensaje}`)
  }
  guardarCorrida(corrida)
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
  config leer
  help | --help`

/** Salida que `main` imprime tal cual (sin JSON), p. ej. la ayuda. */
export class SalidaTexto {
  constructor(readonly texto: string) {}
}

export async function ejecutar(argv: readonly string[], op: OpcionesEjecucion = {}): Promise<unknown> {
  const a = parsearArgs(argv)
  const cmd = a.posicionales[0]
  if (cmd === undefined || cmd === 'help' || a.opciones.help === true) return new SalidaTexto(AYUDA)
  const slug = () => {
    const s = a.posicionales[1]
    if (!s) throw new Error(`Falta el slug de la marca.\n${AYUDA}`)
    return s
  }
  switch (cmd) {
    case 'registrar':
      return cmdRegistrar(a, op)
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
      throw new Error(`Comando desconocido: ${cmd}\n${AYUDA}`)
  }
}

async function main(): Promise<void> {
  try {
    const salida = await ejecutar(process.argv.slice(2))
    process.stdout.write(salida instanceof SalidaTexto ? salida.texto + '\n' : JSON.stringify(salida ?? null, null, 2) + '\n')
  } catch (e) {
    process.stderr.write(`cs: ${(e as Error).message}\n`)
    process.exitCode = 1
  }
}

const esEntrada = process.argv[1] !== undefined && /[\\/]cli\.ts$/.test(process.argv[1])
if (esEntrada) void main()
