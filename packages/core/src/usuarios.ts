// Lista de acceso a la plataforma web (v2.5): quién puede entrar con Google y con qué rol.
// Vive en `<root>/usuarios.json` y se sincroniza por git como `config.json`.
import fs from 'node:fs'
import { z } from 'zod'
import { cargarEnv } from './env.ts'
import { describirErrorZod } from './jsonl.ts'
import { rutaUsuarios } from './rutas.ts'

export const RolUsuario = z.enum(['admin', 'miembro'])
export type RolUsuario = z.infer<typeof RolUsuario>

export const Usuario = z.object({
  email: z.string().email(),
  rol: RolUsuario,
  invitadoPor: z.string().nullable().default(null),
  fecha: z.string().min(1),
})
export type Usuario = z.infer<typeof Usuario>

export const ListaUsuarios = z.object({ usuarios: z.array(Usuario).default([]) })

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Usuarios guardados (sin el admin de arranque). Archivo ausente → lista vacía. */
export function leerUsuariosGuardados(): Usuario[] {
  const ruta = rutaUsuarios()
  if (!fs.existsSync(ruta)) return []
  let crudo: unknown
  try {
    crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  } catch (e) {
    throw new Error(`usuarios.json ilegible: ${(e as Error).message}`)
  }
  const res = ListaUsuarios.safeParse(crudo)
  if (!res.success) throw new Error(`usuarios.json inválido: ${describirErrorZod(res.error)}`)
  return res.data.usuarios
}

/** Lista efectiva: la guardada + `CS_ADMIN_EMAIL` como admin si no figura. */
export function listarUsuarios(): Usuario[] {
  const guardados = leerUsuariosGuardados()
  const admin = cargarEnv().CS_ADMIN_EMAIL
  if (!admin) return guardados
  const email = normalizarEmail(admin)
  if (guardados.some((u) => u.email === email)) return guardados
  return [{ email, rol: 'admin', invitadoPor: null, fecha: '' }, ...guardados]
}

/** El usuario con ese correo, o null si no tiene acceso. Fallo de lectura → null (falla cerrado). */
export function buscarUsuario(email: string | null | undefined): Usuario | null {
  if (!email) return null
  const e = normalizarEmail(email)
  try {
    return listarUsuarios().find((u) => u.email === e) ?? null
  } catch {
    return null
  }
}

function guardar(usuarios: readonly Usuario[]): Usuario[] {
  const valida = ListaUsuarios.parse({ usuarios })
  const ruta = rutaUsuarios()
  const tmp = `${ruta}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(valida, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, ruta)
  return valida.usuarios
}

export class ErrorUsuarios extends Error {}

function exigirAdminRestante(usuarios: readonly Usuario[]): void {
  const admin = cargarEnv().CS_ADMIN_EMAIL
  const hayArranque = admin !== undefined && !usuarios.some((u) => u.email === normalizarEmail(admin))
  if (!hayArranque && !usuarios.some((u) => u.rol === 'admin')) {
    throw new ErrorUsuarios('Tiene que quedar al menos un admin')
  }
}

/** Invita (o reactiva) un correo. Si ya existe, actualiza su rol. */
export function invitarUsuario(email: string, rol: RolUsuario, por: string, ahora: Date = new Date()): Usuario[] {
  const e = normalizarEmail(email)
  if (!z.string().email().safeParse(e).success) throw new ErrorUsuarios('Correo inválido')
  const actuales = leerUsuariosGuardados()
  const resto = actuales.filter((u) => u.email !== e)
  const previo = actuales.find((u) => u.email === e)
  const nuevos = [...resto, { email: e, rol, invitadoPor: previo?.invitadoPor ?? normalizarEmail(por), fecha: previo?.fecha ?? ahora.toISOString() }]
  exigirAdminRestante(nuevos)
  return guardar(nuevos)
}

/** Quita el acceso a un correo. El admin de arranque (`CS_ADMIN_EMAIL`) no se puede revocar desde la app. */
export function revocarUsuario(email: string): Usuario[] {
  const e = normalizarEmail(email)
  const admin = cargarEnv().CS_ADMIN_EMAIL
  if (admin && normalizarEmail(admin) === e) throw new ErrorUsuarios('El admin de arranque (CS_ADMIN_EMAIL) se cambia en .env.local, no desde la app')
  const actuales = leerUsuariosGuardados()
  if (!actuales.some((u) => u.email === e)) throw new ErrorUsuarios('Ese correo no tiene acceso')
  const nuevos = actuales.filter((u) => u.email !== e)
  exigirAdminRestante(nuevos)
  return guardar(nuevos)
}
