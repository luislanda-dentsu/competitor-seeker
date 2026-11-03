// Solo servidor (páginas y proxy): resolución barata de marca activa y de
// slugs de competidor sin cargar KPIs ni gráficas. Importa subrutas del core
// para que el bundle del proxy no arrastre runner/apify/simple-git.
import { leerLog } from "@competitor-seeker/core/log";
import { leerMarca, listarMarcas } from "@competitor-seeker/core/marcas";
import { slugDeCompetidor } from "./agrupar";

/**
 * Slug de la marca activa a partir del valor de la cookie `cs-marca`:
 * la cookie si es válida; si no, la primera marca; si no hay, null.
 */
export function resolverMarcaActiva(cookie: string | undefined): string | null {
  const marcas = listarMarcas();
  if (marcas.length === 0) return null;
  if (cookie && marcas.some((m) => m.slug === cookie)) return cookie;
  return marcas[0]?.slug ?? null;
}

/**
 * Slugs válidos de competidor para una marca: los de la lista de vigilancia
 * (activos o no) y los derivados de nombres que aparecen en el log.
 * Devuelve un Set vacío si la marca no se puede leer.
 */
export function slugsDeCompetidores(marcaSlug: string): Set<string> {
  const slugs = new Set<string>();
  let lista: { slug: string; nombre: string }[] = [];
  try {
    const marca = leerMarca(marcaSlug);
    lista = marca.competidores;
    for (const c of lista) slugs.add(c.slug);
  } catch {
    return slugs;
  }
  try {
    for (const e of leerLog(marcaSlug).items) slugs.add(slugDeCompetidor(e.marca, lista));
  } catch {
    /* log ilegible: los slugs de la lista bastan */
  }
  return slugs;
}
