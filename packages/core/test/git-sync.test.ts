import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reiniciarEnv } from '../src/env.ts'
import { commitYPush, estadoSync, pull, pullSiToca } from '../src/git-sync.ts'

const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })

let tmp: string
let a: string
let b: string

function clonar(nombre: string, origen: string): string {
  const dir = path.join(tmp, nombre)
  git(tmp, 'clone', '-q', origen, dir)
  git(dir, 'config', 'user.name', nombre)
  git(dir, 'config', 'user.email', `${nombre}@test.local`)
  return dir
}

function en(dir: string): void {
  process.env.CS_REPO_ROOT = dir
  reiniciarEnv()
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-sync-'))
  process.env.CS_GIT_RAMA = 'main'
  const bare = path.join(tmp, 'origen.git')
  git(tmp, 'init', '-q', '--bare', '-b', 'main', bare)
  const semilla = path.join(tmp, 'semilla')
  git(tmp, 'init', '-q', '-b', 'main', semilla)
  git(semilla, 'config', 'user.name', 's')
  git(semilla, 'config', 'user.email', 's@test.local')
  fs.writeFileSync(path.join(semilla, 'CLAUDE.md'), '')
  fs.writeFileSync(path.join(semilla, '.gitattributes'), 'marcas/**/log.jsonl merge=union\n')
  fs.writeFileSync(path.join(semilla, '.gitignore'), '/data/\n')
  fs.mkdirSync(path.join(semilla, 'marcas/k'), { recursive: true })
  fs.writeFileSync(path.join(semilla, 'marcas/k/log.jsonl'), '{"n":0}\n')
  fs.writeFileSync(path.join(semilla, 'marcas/k/marca.json'), '{"nombre":"K"}\n')
  git(semilla, 'add', '.')
  git(semilla, 'commit', '-q', '-m', 'semilla')
  git(semilla, 'remote', 'add', 'origin', bare)
  git(semilla, 'push', '-q', 'origin', 'main')
  a = clonar('a', bare)
  b = clonar('b', bare)
})

afterEach(() => {
  delete process.env.CS_REPO_ROOT
  delete process.env.CS_GIT_RAMA
  delete process.env.CS_SYNC_AUTO
  reiniciarEnv()
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('git-sync', () => {
  it('appends distintos a log.jsonl en ambos clones convergen sin conflicto', async () => {
    en(a)
    fs.appendFileSync(path.join(a, 'marcas/k/log.jsonl'), '{"n":"a"}\n')
    expect(await commitYPush('a')).toMatchObject({ ok: true })
    en(b)
    fs.appendFileSync(path.join(b, 'marcas/k/log.jsonl'), '{"n":"b"}\n')
    expect(await commitYPush('b')).toMatchObject({ ok: true })
    en(a)
    expect(await pull()).toMatchObject({ ok: true })
    for (const d of [a, b]) {
      const lineas = fs.readFileSync(path.join(d, 'marcas/k/log.jsonl'), 'utf8').trim().split('\n')
      expect(lineas).toContain('{"n":"a"}')
      expect(lineas).toContain('{"n":"b"}')
    }
  })

  it('edición concurrente de marca.json → conflicto y clon limpio', async () => {
    en(a)
    fs.writeFileSync(path.join(a, 'marcas/k/marca.json'), '{"nombre":"A"}\n')
    expect(await commitYPush('a')).toMatchObject({ ok: true })
    en(b)
    fs.writeFileSync(path.join(b, 'marcas/k/marca.json'), '{"nombre":"B"}\n')
    const r = await commitYPush('b')
    expect(r).toMatchObject({ ok: false, motivo: 'conflicto' })
    expect(fs.existsSync(path.join(b, '.git/rebase-merge'))).toBe(false)
    expect(git(b, 'status', '--porcelain')).toBe('')
    const est = await estadoSync()
    expect(est.conflicto).toContain('marcas/k/marca.json')
    expect(est.adelante).toBe(1)
  })

  it('sin remoto todo se omite', async () => {
    const solo = path.join(tmp, 'solo')
    git(tmp, 'init', '-q', '-b', 'main', solo)
    fs.writeFileSync(path.join(solo, 'CLAUDE.md'), '')
    fs.mkdirSync(path.join(solo, 'marcas'))
    en(solo)
    expect(await pull()).toEqual({ ok: true, omitido: 'sin remoto' })
    expect(await commitYPush('x')).toEqual({ ok: true, omitido: 'sin remoto' })
    expect((await estadoSync()).remoto).toBe(false)
  })

  it('add nunca incluye archivos fuera de marcas/ y config.json', async () => {
    en(a)
    fs.writeFileSync(path.join(a, 'otro.txt'), 'x')
    fs.appendFileSync(path.join(a, 'CLAUDE.md'), 'cambio')
    fs.writeFileSync(path.join(a, 'config.json'), '{}')
    fs.writeFileSync(path.join(a, 'marcas/k/nuevo.json'), '{}')
    expect(await commitYPush('ajustes')).toMatchObject({ ok: true, commit: true })
    const archivos = git(a, 'show', '--name-only', '--pretty=format:', 'HEAD').split('\n').filter(Boolean).sort()
    expect(archivos).toEqual(['config.json', 'marcas/k/nuevo.json'])
    expect(git(a, 'status', '--porcelain')).toContain('otro.txt')
  })

  it('pullSiToca respeta el throttle y CS_SYNC_AUTO=0 desactiva lo automático', async () => {
    en(a)
    expect(await pullSiToca(60_000)).toMatchObject({ ok: true })
    expect(await pullSiToca(60_000)).toEqual({ ok: true, omitido: 'throttle' })
    process.env.CS_SYNC_AUTO = '0'
    reiniciarEnv()
    expect(await commitYPush('x', { auto: true })).toMatchObject({ omitido: 'sync automático desactivado' })
  })
  it('en una rama de feature no hace pull ni push (nunca empuja la rama a main)', async () => {
    en(a)
    git(a, 'checkout', '-q', '-b', 'feat/x')
    fs.appendFileSync(path.join(a, 'marcas/k/log.jsonl'), '{"n":9}\n')
    const r = await commitYPush('corrida')
    expect(r).toMatchObject({ ok: true })
    expect((r as { omitido?: string }).omitido).toMatch(/rama distinta/)
    expect((await pull()) as { omitido?: string }).toMatchObject({ omitido: expect.stringMatching(/rama distinta/) })
    expect(git(a, 'ls-remote', 'origin', 'main').split('\t')[0]).toBe(git(b, 'rev-parse', 'HEAD').trim())
    expect((await estadoSync()).pausado).toMatch(/rama distinta/)
  })

  it('con código sin commitear el pull se omite (no se stashea trabajo de desarrollo)', async () => {
    en(a)
    fs.appendFileSync(path.join(a, 'CLAUDE.md'), 'trabajo en curso')
    const r = (await pull()) as { ok: boolean; omitido?: string }
    expect(r.ok).toBe(true)
    expect(r.omitido).toMatch(/código sin commitear/)
    expect(git(a, 'stash', 'list').trim()).toBe('')
    expect(fs.readFileSync(path.join(a, 'CLAUDE.md'), 'utf8')).toContain('trabajo en curso')
  })
})
