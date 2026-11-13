import { NextResponse, type NextRequest } from "next/server";
// Rutas relativas (no `@/`): así vitest carga el proxy sin alias (slugs.test.ts).
import { MARCA_COOKIE } from "./brand-cookie";
import { resolverMarcaActiva, slugsDeCompetidores } from "./data/slugs";

/** Slug decodificado, o null si el segmento trae un porcentaje malformado. */
function decodificarSlug(segmento: string): string | null {
  try {
    return decodeURIComponent(segmento);
  } catch {
    return null;
  }
}

/** Solo /competidores/<slug> (un segmento): la ficha de un competidor. */
export function esFichaCompetidor(pathname: string): boolean {
  return /^\/competidores\/[^/]+\/?$/.test(pathname);
}

/**
 * /competidores/[slug]: si el slug no existe en la marca activa, reescribe a una ruta
 * inexistente para que Next responda con un 404 REAL. Con Cache Components la decisión no
 * puede tomarse en la página: su shell estático ya se envió con 200 cuando la isla dinámica
 * llama a notFound(). Las páginas siguen llamando a notFound() como red.
 *
 * Si `marca.json` no se puede leer, deja pasar: la página mostrará su `error.tsx`.
 */
export function proxyCompetidor(request: NextRequest): NextResponse {
  const segmento = request.nextUrl.pathname.split("/")[2];
  if (!segmento) return NextResponse.next();
  const slug = decodificarSlug(segmento);
  if (slug !== null) {
    const marca = resolverMarcaActiva(request.cookies.get(MARCA_COOKIE)?.value);
    if (marca) {
      let slugs: Set<string>;
      try {
        slugs = slugsDeCompetidores(marca);
      } catch {
        return NextResponse.next();
      }
      if (slugs.has(slug)) return NextResponse.next();
    }
  }
  // Dos segmentos bajo /competidores: no casa con [slug] ni con ninguna ruta.
  const destino = request.nextUrl.clone();
  destino.pathname = "/competidores/_/no-encontrado";
  return NextResponse.rewrite(destino);
}
