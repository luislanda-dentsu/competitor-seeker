// Historial del asistente: `data/chats/<marca>/<chatId>.json` (estado local,
// gitignored). Un chat = una sesión de `claude -p` (`sessionId`) más sus
// mensajes; el runner web lo guarda al terminar cada turno.
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { describirErrorZod } from './jsonl.ts'
import { rutaDataArchivo } from './rutas.ts'

export const ArtefactoEntradas = z.object({
  titulo: z.string().min(1),
  ids: z.array(z.string().min(1)),
})
export type ArtefactoEntradas = z.infer<typeof ArtefactoEntradas>

export const FeedbackChat = z.enum(['up', 'down'])
export type FeedbackChat = z.infer<typeof FeedbackChat>

export const MensajeChat = z.object({
  rol: z.enum(['usuario', 'asistente']),
  texto: z.string(),
  /** ISO 8601. */
  ts: z.string().min(1),
  artefacto: ArtefactoEntradas.optional(),
  feedback: FeedbackChat.optional(),
})
export type MensajeChat = z.infer<typeof MensajeChat>

export const Chat = z.object({
  id: z.string().min(1),
  marca: z.string().min(1),
  titulo: z.string().min(1),
  creado: z.string().min(1),
  actualizado: z.string().min(1),
  /** Id de sesión de Claude Code; ausente hasta que la primera respuesta inicia sesión. */
  sessionId: z.string().optional(),
  mensajes: z.array(MensajeChat).default([]),
})
export type Chat = z.infer<typeof Chat>

/** Resumen para listados (sin mensajes). */
export interface ChatResumen {
  id: string
  marca: string
  titulo: string
  creado: string
  actualizado: string
  mensajes: number
}

const PALABRAS_TITULO = 6
const MAX_TITULO = 80

/** Id de chat válido: UUID (lo genera `nuevoChat`); evita rutas y separadores. */
export function esIdChatValido(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export function rutaChats(marca: string): string {
  return rutaDataArchivo('chats', marca)
}

export function rutaChat(marca: string, id: string): string {
  if (!esIdChatValido(id)) throw new Error(`Id de chat inválido: ${id}`)
  return path.join(rutaChats(marca), `${id}.json`)
}

/** Primeras 6 palabras del mensaje (una línea, sin markdown de cabecera), máximo 80 caracteres. */
export function tituloDeMensaje(texto: string): string {
  const plano = texto.replace(/\s+/g, ' ').replace(/^[#>*\-\s]+/, '').trim()
  if (plano === '') return 'Nuevo chat'
  const palabras = plano.split(' ')
  let titulo = palabras.slice(0, PALABRAS_TITULO).join(' ')
  if (titulo.length > MAX_TITULO) titulo = titulo.slice(0, MAX_TITULO - 1).trimEnd() + '…'
  else if (palabras.length > PALABRAS_TITULO) titulo += '…'
  return titulo
}

function resumir(chat: Chat): ChatResumen {
  return { id: chat.id, marca: chat.marca, titulo: chat.titulo, creado: chat.creado, actualizado: chat.actualizado, mensajes: chat.mensajes.length }
}

function leerArchivo(ruta: string): Chat | null {
  let crudo: unknown
  try {
    crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  } catch {
    return null
  }
  const res = Chat.safeParse(crudo)
  return res.success ? res.data : null
}

/** Chats de la marca ordenados por `actualizado` descendente. Ignora archivos rotos. */
export function listarChats(marca: string): ChatResumen[] {
  let archivos: string[]
  try {
    archivos = fs.readdirSync(rutaChats(marca)).filter((a) => a.endsWith('.json'))
  } catch {
    return []
  }
  const chats: ChatResumen[] = []
  for (const archivo of archivos) {
    const chat = leerArchivo(path.join(rutaChats(marca), archivo))
    if (chat && chat.marca === marca) chats.push(resumir(chat))
  }
  chats.sort((a, b) => (a.actualizado < b.actualizado ? 1 : a.actualizado > b.actualizado ? -1 : a.id.localeCompare(b.id)))
  return chats
}

/** Lee un chat; null si no existe. Lanza si el archivo existe pero es inválido. */
export function leerChat(marca: string, id: string): Chat | null {
  const ruta = rutaChat(marca, id)
  let texto: string
  try {
    texto = fs.readFileSync(ruta, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch (e) {
    throw new Error(`Chat ${id} ilegible: ${(e as Error).message}`)
  }
  const res = Chat.safeParse(crudo)
  if (!res.success) throw new Error(`Chat ${id} inválido: ${describirErrorZod(res.error)}`)
  return res.data
}

/** Escribe el chat completo (pretty). Crea la carpeta si falta. */
export function guardarChat(chat: Chat): Chat {
  const valido = Chat.parse(chat)
  const ruta = rutaChat(valido.marca, valido.id)
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  fs.writeFileSync(ruta, JSON.stringify(valido, null, 2) + '\n', 'utf8')
  return valido
}

export interface OpcionesNuevoChat {
  id?: string
  ahora?: Date
}

/**
 * Chat nuevo en memoria (NO lo escribe): id UUID, título derivado del primer
 * mensaje y ese mensaje como primer turno del usuario.
 */
export function nuevoChat(marca: string, primerMensaje: string, o: OpcionesNuevoChat = {}): Chat {
  const ts = (o.ahora ?? new Date()).toISOString()
  return {
    id: o.id ?? randomUUID(),
    marca,
    titulo: tituloDeMensaje(primerMensaje),
    creado: ts,
    actualizado: ts,
    mensajes: [{ rol: 'usuario', texto: primerMensaje, ts }],
  }
}

/** Borra el archivo del chat. Devuelve false si no existía. */
export function borrarChat(marca: string, id: string): boolean {
  try {
    fs.rmSync(rutaChat(marca, id))
    return true
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw e
  }
}

export const GRUPOS_FECHA = ['Hoy', 'Ayer', 'Últimos 7 días', 'Anteriores'] as const
export type GrupoFecha = (typeof GRUPOS_FECHA)[number]

export interface GrupoChats<T extends { actualizado: string } = ChatResumen> {
  grupo: GrupoFecha
  chats: T[]
}

function inicioDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Grupo de un chat por su `actualizado` respecto a `ahora` (hora local). */
export function grupoDeFecha(actualizado: string, ahora: Date): GrupoFecha {
  const t = Date.parse(actualizado)
  if (!Number.isFinite(t)) return 'Anteriores'
  const hoy = inicioDia(ahora)
  const dia = 24 * 60 * 60 * 1000
  if (t >= hoy) return 'Hoy'
  if (t >= hoy - dia) return 'Ayer'
  if (t >= hoy - 7 * dia) return 'Últimos 7 días'
  return 'Anteriores'
}

/** Agrupa (conservando el orden recibido) en Hoy / Ayer / Últimos 7 días / Anteriores; omite grupos vacíos. */
export function agruparPorFecha<T extends { actualizado: string }>(chats: readonly T[], ahora: Date = new Date()): GrupoChats<T>[] {
  const porGrupo = new Map<GrupoFecha, T[]>(GRUPOS_FECHA.map((g) => [g, []]))
  for (const c of chats) porGrupo.get(grupoDeFecha(c.actualizado, ahora))!.push(c)
  return GRUPOS_FECHA.filter((g) => porGrupo.get(g)!.length > 0).map((g) => ({ grupo: g, chats: porGrupo.get(g)! }))
}
