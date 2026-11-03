// Lectura de `config.json` (compartida) y `data/secrets.json` (local).
import fs from 'node:fs'
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

/** `data/secrets.json`; la variable `APIFY_TOKEN` prevalece sobre el archivo. */
export function leerSecrets(): Secrets {
  let desdeArchivo: Secrets = {}
  const ruta = rutaSecrets()
  if (fs.existsSync(ruta)) {
    const res = Secrets.safeParse(JSON.parse(fs.readFileSync(ruta, 'utf8')))
    if (res.success) desdeArchivo = res.data
  }
  const token = cargarEnv().APIFY_TOKEN
  return token ? { ...desdeArchivo, apifyToken: token } : desdeArchivo
}
