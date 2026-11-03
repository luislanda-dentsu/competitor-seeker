import { z } from 'zod'

export const PresupuestoApify = z.object({
  /** null → se toma del límite mensual que reporta la API de Apify. */
  mensualUsd: z.number().nonnegative().nullable().default(null),
  /** null → mensual / días del ciclo. */
  diarioUsd: z.number().nonnegative().nullable().default(null),
  /** null → diario × 7. */
  semanalUsd: z.number().nonnegative().nullable().default(null),
})
export type PresupuestoApify = z.infer<typeof PresupuestoApify>

export const ConfigApify = z.object({
  habilitado: z.boolean().default(true),
  resultsLimitPorPerfil: z.number().int().positive().default(12),
  presupuesto: PresupuestoApify.prefault({}),
  umbrales: z.array(z.number().min(0).max(100)).default([70, 90, 100]),
  saltarSiPctMensual: z.number().min(0).max(100).default(90),
})
export type ConfigApify = z.infer<typeof ConfigApify>

export const ConfigSync = z.object({
  auto: z.boolean().default(true),
  rama: z.string().min(1).default('main'),
})
export type ConfigSync = z.infer<typeof ConfigSync>

/** `config.json` compartido por git. `ConfigCompartida.parse({})` da los defaults. */
export const ConfigCompartida = z.object({
  apify: ConfigApify.prefault({}),
  sync: ConfigSync.prefault({}),
})
export type ConfigCompartida = z.infer<typeof ConfigCompartida>

/** Secretos locales (`data/secrets.json`), nunca sincronizados. */
export const Secrets = z.object({
  apifyToken: z.string().min(1).optional(),
})
export type Secrets = z.infer<typeof Secrets>
