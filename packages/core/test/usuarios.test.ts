// Lista de acceso (v2.5): admin de arranque, invitar, revocar y que nunca quede sin admin.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reiniciarEnv } from '../src/env.ts'
import { buscarUsuario, ErrorUsuarios, invitarUsuario, listarUsuarios, revocarUsuario } from '../src/usuarios.ts'
import { crearRepoTemporal, type RepoTemporal } from './helpers.ts'

describe('usuarios', () => {
  let repo: RepoTemporal
  beforeEach(() => {
    repo = crearRepoTemporal()
  })
  afterEach(() => {
    delete process.env.CS_ADMIN_EMAIL
    reiniciarEnv()
    repo.limpiar()
  })

  it('sin archivo ni admin de arranque nadie entra', () => {
    expect(listarUsuarios()).toEqual([])
    expect(buscarUsuario('a@b.com')).toBeNull()
  })

  it('CS_ADMIN_EMAIL entra como admin sin estar en el archivo (sin distinguir mayúsculas)', () => {
    process.env.CS_ADMIN_EMAIL = 'Luis@Ejemplo.com'
    reiniciarEnv()
    expect(buscarUsuario('luis@ejemplo.com')?.rol).toBe('admin')
    expect(buscarUsuario(' LUIS@ejemplo.com ')?.rol).toBe('admin')
  })

  it('invitar, cambiar rol y revocar; el archivo queda válido', () => {
    process.env.CS_ADMIN_EMAIL = 'luis@ejemplo.com'
    reiniciarEnv()
    invitarUsuario('Ana@Ejemplo.com', 'miembro', 'luis@ejemplo.com', new Date('2026-11-13T00:00:00Z'))
    expect(buscarUsuario('ana@ejemplo.com')).toMatchObject({ rol: 'miembro', invitadoPor: 'luis@ejemplo.com' })
    invitarUsuario('ana@ejemplo.com', 'admin', 'otro@ejemplo.com')
    expect(buscarUsuario('ana@ejemplo.com')).toMatchObject({ rol: 'admin', invitadoPor: 'luis@ejemplo.com', fecha: '2026-11-13T00:00:00.000Z' })
    revocarUsuario('ana@ejemplo.com')
    expect(buscarUsuario('ana@ejemplo.com')).toBeNull()
    expect(JSON.parse(fs.readFileSync(path.join(repo.raiz, 'usuarios.json'), 'utf8'))).toEqual({ usuarios: [] })
  })

  it('no deja la lista sin admin ni revoca al admin de arranque', () => {
    invitarUsuario('ana@ejemplo.com', 'admin', 'x@ejemplo.com')
    expect(() => invitarUsuario('ana@ejemplo.com', 'miembro', 'x@ejemplo.com')).toThrow(ErrorUsuarios)
    expect(() => revocarUsuario('ana@ejemplo.com')).toThrow(/admin/)
    process.env.CS_ADMIN_EMAIL = 'luis@ejemplo.com'
    reiniciarEnv()
    expect(() => revocarUsuario('luis@ejemplo.com')).toThrow(/arranque/)
    // Con admin de arranque, Ana sí puede dejar de ser admin.
    invitarUsuario('ana@ejemplo.com', 'miembro', 'luis@ejemplo.com')
    expect(buscarUsuario('ana@ejemplo.com')?.rol).toBe('miembro')
  })

  it('archivo corrupto → nadie entra (falla cerrado)', () => {
    fs.writeFileSync(path.join(repo.raiz, 'usuarios.json'), '{nope')
    expect(buscarUsuario('ana@ejemplo.com')).toBeNull()
  })

  it('correo inválido se rechaza', () => {
    expect(() => invitarUsuario('no-es-correo', 'miembro', 'x@ejemplo.com')).toThrow(/inválido/)
  })
})
