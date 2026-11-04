import { z } from 'zod'
import { FechaISO } from './entrada.ts'

// Datos de rendimiento por publicación y por perfil que el workflow consolida en cada
// corrida (rastreador-ig + rastreador-apify) y `cs registrar` guarda en corridas/<id>.json.
// El campo `competidor` es el NOMBRE del competidor (igual que `Entrada.marca`).

export const FormatoPost = z.enum(['reel', 'carrusel', 'imagen', 'video', 'otro'])
export type FormatoPost = z.infer<typeof FormatoPost>

export const FuentePost = z.enum(['ig', 'apify'])
export type FuentePost = z.infer<typeof FuentePost>

const Conteo = z.number().int().nonnegative()

export const Publicacion = z.object({
  competidor: z.string().min(1),
  url: z.string().url(),
  fecha: FechaISO,
  formato: FormatoPost,
  /** Caption resumido o tema del post. */
  tema: z.string().max(300).optional(),
  likes: Conteo.optional(),
  comentarios: Conteo.optional(),
  vistas: Conteo.optional(),
  fuente: FuentePost,
})
export type Publicacion = z.infer<typeof Publicacion>

export const PerfilSnapshot = z.object({
  competidor: z.string().min(1),
  seguidores: Conteo.optional(),
  publicacionesTotales: Conteo.optional(),
  fuente: FuentePost,
})
export type PerfilSnapshot = z.infer<typeof PerfilSnapshot>

export const Confianza = z.enum(['alta', 'media', 'baja'])
export type Confianza = z.infer<typeof Confianza>

/** Lectura estratégica que el analista infiere del contenido del periodo (y el verificador refuta). */
export const EstrategiaCompetidor = z.object({
  hipotesis: z.array(z.string().min(1)).min(1),
  pilares: z.array(z.string().min(1)).default([]),
  formatosYCadencia: z.string().min(1),
  implicaciones: z.array(z.string().min(1)).default([]),
  confianza: Confianza,
  /** URLs de las publicaciones en que se apoya la estrategia. */
  postsCitados: z.array(z.string().min(1)).default([]),
})
export type EstrategiaCompetidor = z.infer<typeof EstrategiaCompetidor>

export const LecturaCompetidor = z.object({
  competidor: z.string().min(1),
  /** 3–5 bullets: en qué consistieron las publicaciones del periodo. */
  resumen: z.array(z.string().min(1)).max(8),
  /** Ausente si no hay evidencia suficiente (p. ej. competidor sin datos). */
  estrategia: EstrategiaCompetidor.optional(),
})
export type LecturaCompetidor = z.infer<typeof LecturaCompetidor>

/** Shortcode de una URL de IG (`/p/<id>/`, `/reel/<id>/`, `/tv/<id>/`) o la URL normalizada. */
export function clavePublicacion(url: string): string {
  const m = /instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([^/?#]+)/i.exec(url)
  if (m) return `ig:${m[1]}`
  return url.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase()
}
