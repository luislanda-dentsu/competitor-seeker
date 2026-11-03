import { z } from 'zod'

export const Competidor = z.object({
  slug: z.string().min(1),
  nombre: z.string().min(1),
  url: z.url().optional(),
  instagram: z.string().min(1).optional(),
  activo: z.boolean().default(true),
})
export type Competidor = z.infer<typeof Competidor>

export const Marca = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug inválido'),
  nombre: z.string().min(1),
  creadaEn: z.string().min(1),
  competidores: z.array(Competidor).default([]),
})
export type Marca = z.infer<typeof Marca>
