// Decisión de acceso (pura: la usan proxy.ts y los route handlers; sin alias `@/` para vitest).
import type { Env } from "@competitor-seeker/core";

/**
 * - `google`: login con Google + lista de acceso (lo normal).
 * - `abierto-local`: CS_AUTH=off, solo desarrollo; nunca responde a lo que llega por la puerta de Cloudflare.
 * - `sin-configurar`: falta AUTH_SECRET o el cliente de Google → no se sirve nada (falla cerrado).
 */
export type ModoAcceso = "google" | "abierto-local" | "sin-configurar";

export function modoAcceso(env: Pick<Env, "CS_AUTH" | "AUTH_SECRET" | "AUTH_GOOGLE_ID" | "AUTH_GOOGLE_SECRET">): ModoAcceso {
  if (env.CS_AUTH === "off") return "abierto-local";
  return env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET ? "google" : "sin-configurar";
}

/** Rutas que se sirven sin sesión: pantalla de entrada, endpoints de Auth.js y la sonda de salud del Worker. */
export function esRutaPublica(pathname: string): boolean {
  return (
    pathname === "/entrar" ||
    pathname.startsWith("/entrar/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/salud"
  );
}

export type Decision =
  | { tipo: "pasar" }
  | { tipo: "redirigir"; a: string }
  | { tipo: "error"; status: 401 | 403 | 503; mensaje: string };

export interface PeticionAcceso {
  pathname: string;
  search: string;
  modo: ModoAcceso;
  /** Correo de la sesión (null sin sesión). */
  email: string | null;
  /** El correo está en la lista de acceso. */
  permitido: boolean;
  /** La petición llegó por la puerta de Cloudflare (trae cf-connecting-ip). */
  viaPuerta: boolean;
  /** Trae el secreto interno Mac ↔ Worker (solo vale para la consulta de estado de corridas). */
  interno?: boolean;
}

/** Única ruta que la otra Mac puede consultar con el secreto interno (sin sesión de usuario). */
export const RUTA_ESTADO_INTERNA = "/api/corridas/estado";

/** Comparación en tiempo constante (sin depender de node:crypto: el proxy la importa sin alias). */
export function secretoValido(recibido: string | null, esperado: string | undefined): boolean {
  if (!recibido || !esperado || recibido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

export function decidirAcceso(p: PeticionAcceso): Decision {
  const api = p.pathname.startsWith("/api/");
  if (p.modo === "sin-configurar") {
    return { tipo: "error", status: 503, mensaje: "Acceso no configurado: faltan AUTH_SECRET, AUTH_GOOGLE_ID o AUTH_GOOGLE_SECRET en .env.local" };
  }
  if (p.modo === "abierto-local") {
    return p.viaPuerta
      ? { tipo: "error", status: 503, mensaje: "Este panel está en modo desarrollo (CS_AUTH=off) y no se sirve por la web" }
      : { tipo: "pasar" };
  }
  if (esRutaPublica(p.pathname)) return { tipo: "pasar" };
  if (p.interno && p.pathname === RUTA_ESTADO_INTERNA) return { tipo: "pasar" };
  if (!p.email) {
    if (api) return { tipo: "error", status: 401, mensaje: "Inicia sesión" };
    const desde = p.pathname === "/" ? "" : `?desde=${encodeURIComponent(p.pathname + p.search)}`;
    return { tipo: "redirigir", a: `/entrar${desde}` };
  }
  if (!p.permitido) {
    return api ? { tipo: "error", status: 403, mensaje: "Tu cuenta no tiene acceso" } : { tipo: "redirigir", a: "/entrar/sin-acceso" };
  }
  return { tipo: "pasar" };
}

/** Solo rutas internas como destino tras el login (evita redirecciones abiertas). */
export function destinoSeguro(desde: string | null | undefined): string {
  if (!desde || !desde.startsWith("/") || desde.startsWith("//") || desde.startsWith("/\\")) return "/";
  return desde;
}
