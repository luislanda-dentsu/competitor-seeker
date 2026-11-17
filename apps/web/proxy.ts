import { buscarUsuario, cargarEnv } from "@competitor-seeker/core";
import { NextResponse, type NextRequest } from "next/server";
// Rutas relativas (no `@/`): el proxy se carga sin alias.
import { decidirAcceso, esHostLocal, modoAcceso, secretoValido, type Decision } from "./lib/acceso";
import { auth } from "./lib/auth";
import { esFichaCompetidor, proxyCompetidor } from "./lib/proxy-competidores";

function aplicar(request: NextRequest, d: Decision): NextResponse {
  if (d.tipo === "redirigir") return NextResponse.redirect(new URL(d.a, request.nextUrl));
  if (d.tipo === "error") {
    if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: d.mensaje }, { status: d.status });
    return new NextResponse(`${d.mensaje}\n`, { status: d.status, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return esFichaCompetidor(request.nextUrl.pathname) ? proxyCompetidor(request) : NextResponse.next();
}

function decidir(request: NextRequest, email: string | null): NextResponse {
  const { pathname, search } = request.nextUrl;
  const env = cargarEnv();
  return aplicar(
    request,
    decidirAcceso({
      pathname,
      search,
      modo: modoAcceso(env),
      email,
      permitido: buscarUsuario(email) !== null,
      // La puerta siempre añade x-cs-puerta; Cloudflare añade cf-*. Cualquiera basta.
      viaPuerta: ["x-cs-puerta", "cf-connecting-ip", "cf-ray"].some((h) => request.headers.has(h)),
      hostLocal: esHostLocal(request.headers.get("host")),
      interno: secretoValido(request.headers.get("x-cs-interno"), env.CS_SECRETO_INTERNO),
    }),
  );
}

const conSesion = auth((request) => decidir(request, request.auth?.user?.email ?? null));

/**
 * Puerta de toda la app: sin sesión válida y en la lista de acceso no se sirve nada
 * (falla cerrado si la auth no está configurada). Luego, el 404 real de /competidores/[slug].
 */
export function proxy(request: NextRequest, ctx: unknown): Promise<Response> | Response {
  if (modoAcceso(cargarEnv()) !== "google") return decidir(request, null);
  return (conSesion as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(request, ctx);
}

export const config = {
  // Todo menos los estáticos de Next (los estáticos no llevan datos).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
