// Lectura de `config.json` (compartida) y `data/secrets.json` (local).
import fs from 'node:fs'
import path from 'node:path'
import { cargarEnv } from './env.ts'
import { describirErrorZod } from './jsonl.ts'
import { rutaConfig, rutaDataArchivo } from './rutas.ts'
import { ConfigCompartida, Secrets } from './schemas/config.ts'

/** `config.json` parseado con defaults; si no existe, los defaults. */
export function leerConfig(): ConfigCompartida {
  const ruta = rutaConfig()
  if (!fs.existsSync(ruta)) return ConfigCompartida.parse({})
  let crudo: unknown
  try {
    crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  } catch (e) {
    throw new Error(`config.json ilegible: ${(e as Error).message}`)
  }
  const res = ConfigCompartida.safeParse(crudo)
  if (!res.success) throw new Error(`config.json inválido: ${describirErrorZod(res.error)}`)
  return res.data
}

export function guardarConfig(config: ConfigCompartida): ConfigCompartida {
  const valida = ConfigCompartida.parse(config)
  fs.writeFileSync(rutaConfig(), JSON.stringify(valida, null, 2) + '\n', 'utf8')
  return valida
}

export function rutaSecrets(): string {
  return rutaDataArchivo('secrets.json')
}

/** Solo lo que hay en `data/secrets.json` (sin mezclar `APIFY_TOKEN` del entorno). */
export function leerSecretsArchivo(): Secrets {
  const ruta = rutaSecrets()
  if (!fs.existsSync(ruta)) return {}
  try {
    const res = Secrets.safeParse(JSON.parse(fs.readFileSync(ruta, 'utf8')))
    return res.success ? res.data : {}
  } catch {
    return {}
  }
}

/** `data/secrets.json`; la variable `APIFY_TOKEN` prevalece sobre el archivo. */
export function leerSecrets(): Secrets {
  const desdeArchivo = leerSecretsArchivo()
  const token = cargarEnv().APIFY_TOKEN
  return token ? { ...desdeArchivo, apifyToken: token } : desdeArchivo
}

/**
 * Escribe `data/secrets.json` con modo 0600 (solo el usuario). Crea `data/` si falta.
 * Sobrescribe el archivo completo: pásale el objeto ya mezclado con lo anterior.
 */
export function guardarSecrets(secrets: Secrets): Secrets {
  const validos = Secrets.parse(secrets)
  const ruta = rutaSecrets()
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  fs.writeFileSync(ruta, JSON.stringify(validos, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  // `mode` solo aplica al crear: si ya existía con otros permisos, los corregimos.
  fs.chmodSync(ruta, 0o600)
  return validos
}
