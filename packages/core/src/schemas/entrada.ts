import { z } from 'zod'

export const Senal = z.enum(['nuevo', 'confuso', 'sin-datos', 'no-funciona'])
export type Senal = z.infer<typeof Senal>

/** Fecha ISO `AAAA-MM-DD`. */
export const FechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser AAAA-MM-DD')
export type FechaISO = z.infer<typeof FechaISO>

export const Fuente = z.enum(['ig', 'web', 'apify'])
export type Fuente = z.infer<typeof Fuente>

export const Metricas = z.object({
  likes: z.number().nonnegative().optional(),
  comentarios: z.number().nonnegative().optional(),
  vistas: z.number().nonnegative().optional(),
  posts: z.number().nonnegative().optional(),
})
export type Metricas = z.infer<typeof Metricas>

/** Lo que devuelve el workflow (los 5 campos clásicos + opcionales). */
export const EntradaAgente = z.object({
  marca: z.string().min(1),
  fecha: FechaISO,
  movimiento: z.string().min(1),
  senal: Senal,
  lectura: z.string().min(1),
  fuentes: z.array(Fuente).optional(),
  metricas: Metricas.optional(),
  evidencia: z.array(z.url()).optional(),
})
export type EntradaAgente = z.infer<typeof EntradaAgente>

/** Entrada persistida en `log.jsonl`: EntradaAgente + id determinista + corrida. */
export const Entrada = EntradaAgente.extend({
  id: z.string().regex(/^[0-9a-f]{16}$/, 'id debe ser sha1 truncado a 16 hex'),
  corrida: z.string().min(1),
})
export type Entrada = z.infer<typeof Entrada>
