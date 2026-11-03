// Repo temporal para tests: CLAUDE.md vacío + marcas/ y CS_REPO_ROOT apuntando ahí.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { reiniciarEnv } from '../src/env.ts'

export interface RepoTemporal {
  raiz: string
  limpiar(): void
}

export function crearRepoTemporal(): RepoTemporal {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-core-'))
  fs.writeFileSync(path.join(raiz, 'CLAUDE.md'), '')
  fs.mkdirSync(path.join(raiz, 'marcas'))
  process.env.CS_REPO_ROOT = raiz
  reiniciarEnv()
  return {
    raiz,
    limpiar() {
      delete process.env.CS_REPO_ROOT
      reiniciarEnv()
      fs.rmSync(raiz, { recursive: true, force: true })
    },
  }
}

export const FIXTURES = path.join(import.meta.dirname, 'fixtures')

export function leerFixture(nombre: string): string {
  return fs.readFileSync(path.join(FIXTURES, nombre), 'utf8')
}
