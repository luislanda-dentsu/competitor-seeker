import { NextResponse, type NextRequest } from "next/server";
import { MARCA_COOKIE } from "@/lib/brand-cookie";
import { resolverMarcaActiva, slugsDeCompetidores } from "@/lib/data/slugs";

/**
 * Proxy (Node.js) para /competidores/[slug]: si el slug no existe en la
 * marca activa, reescribe a una ruta inexistente para que Next responda con
 * un 404 REAL. Con Cache Components la decisión no puede tomarse en la
 * página: su shell estático ya se envió con 200 cuando la isla dinámica
 * llama a notFound(). Las páginas siguen llamando a notFound() como red.
 */
export function proxy(request: NextRequest): NextResponse {
  const slug = request.nextUrl.pathname.split("/")[2];
  if (!slug) return NextResponse.next();
  const marca = resolverMarcaActiva(request.cookies.get(MARCA_COOKIE)?.value);
  if (marca && slugsDeCompetidores(marca).has(decodeURIComponent(slug))) {
    return NextResponse.next();
  }
  // Dos segmentos bajo /competidores: no casa con [slug] ni con ninguna ruta.
  const destino = request.nextUrl.clone();
  destino.pathname = "/competidores/_/no-encontrado";
  return NextResponse.rewrite(destino);
}

export const config = {
  matcher: ["/competidores/:slug"],
};
