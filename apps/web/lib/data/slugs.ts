// Solo servidor (páginas y proxy): resolución barata de marca activa y de
// slugs de competidor sin cargar KPIs ni gráficas. Importa subrutas del core
// para que el bundle del proxy no arrastre runner/apify/simple-git.
import fs from "node:fs";
import { leerLog } from "@competitor-seeker/core/log";
import { leerMarca, listarMarcas } from "@competitor-seeker/core/marcas";
import { rutaLog, rutaMarcaJson } from "@competitor-seeker/core/rutas";
import { resolverSlugsCompetidores } from "./agrupar";

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

/** Huella de un archivo para invalidar la caché: mtime + tamaño ("" si no existe). */
function huella(ruta: string): string {
  try {
    const st = fs.statSync(ruta);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return "";
  }
}

interface SlugsCacheados {
  huella: string;
  slugs: Set<string>;
}

/** Caché por marca (vive lo que viva el módulo); se invalida por mtime/tamaño. */
const cacheSlugs = new Map<string, SlugsCacheados>();

/**
 * Slugs válidos de competidor para una marca: exactamente los que
 * `resumirCompetidores` (lib/data/marca.ts) expone en listas, sidebar y
 * ficha — mismo conjunto, misma desambiguación de colisiones.
 *
 * Lanza si `marca.json` no existe o es inválido (el proxy deja pasar la
 * petición para que la página muestre su `error.tsx`). Un log ilegible no
 * lanza: valen los slugs de la lista de vigilancia.
 *
 * Cacheado por marca con invalidación por mtime/tamaño de `marca.json` y
 * `log.jsonl`, para que el proxy no relea el log en cada petición.
 */
export function slugsDeCompetidores(marcaSlug: string): Set<string> {
  const clave = `${huella(rutaMarcaJson(marcaSlug))}|${huella(rutaLog(marcaSlug))}`;
  const previo = cacheSlugs.get(marcaSlug);
  if (previo && previo.huella === clave) return previo.slugs;

  const marca = leerMarca(marcaSlug);
  let nombresLog: string[] = [];
  try {
    nombresLog = leerLog(marcaSlug).items.map((e) => e.marca);
  } catch {
    /* log ilegible: los slugs de la lista bastan */
  }
  const slugs = new Set(resolverSlugsCompetidores(marca.competidores, nombresLog).map((c) => c.slug));
  cacheSlugs.set(marcaSlug, { huella: clave, slugs });
  return slugs;
}

/** Vacía la caché (tests). */
export function olvidarSlugsCacheados(): void {
  cacheSlugs.clear();
}
