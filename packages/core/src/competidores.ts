// Utilidades puras sobre competidores: slugs, parseo del competidores.txt
// legacy y extracción del handle de Instagram.
import { Competidor } from './schemas/marca.ts'

/** Minúsculas, sin acentos, solo [a-z0-9] separados por guiones. */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface CompetidorTxt {
  nombre: string
  url?: string
}

/** Parsea líneas `Nombre | URL` (la URL es opcional). Ignora vacías y comentarios `#`. */
export function parseCompetidoresTxt(texto: string): CompetidorTxt[] {
  const salida: CompetidorTxt[] = []
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim()
    if (limpia === '' || limpia.startsWith('#')) continue
    const [nombreCrudo = '', urlCruda = ''] = limpia.split('|').map((p) => p.trim())
    if (nombreCrudo === '') continue
    salida.push(urlCruda ? { nombre: nombreCrudo, url: urlCruda } : { nombre: nombreCrudo })
  }
  return salida
}

/** `https://www.instagram.com/cocacolard/?hl=es` → `cocacolard`. Undefined si no es IG. */
export function handleInstagram(url: string | undefined): string | undefined {
  if (!url) return undefined
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }
  if (!/(^|\.)instagram\.com$/i.test(parsed.hostname)) return undefined
  const segmento = parsed.pathname.split('/').filter(Boolean)[0]
  if (!segmento) return undefined
  const reservados = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct'])
  if (reservados.has(segmento.toLowerCase())) return undefined
  return segmento.replace(/^@/, '')
}

/** Construye un `Competidor` completo (slug, instagram, activo) a partir de nombre y url. */
export function competidorDesde(base: CompetidorTxt): Competidor {
  const instagram = handleInstagram(base.url)
  return Competidor.parse({
    slug: slugify(base.nombre),
    nombre: base.nombre,
    ...(base.url ? { url: base.url } : {}),
    ...(instagram ? { instagram } : {}),
    activo: true,
  })
}
