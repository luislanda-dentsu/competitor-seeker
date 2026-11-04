import { consultarLimites, guardarCacheUso, huellaToken, leerSecrets } from "@competitor-seeker/core";
import { errorJson, okJson } from "@/lib/settings/api";

/** Mensaje legible según el fallo de la API de Apify. */
function describirFallo(e: unknown): string {
  const msg = (e as Error).message ?? String(e);
  if (/401|403/.test(msg)) return "Apify rechazó el token (401/403). Revisa que sea un token de API válido.";
  if (/ENOTFOUND|ECONN|fetch failed|network/i.test(msg)) return "No hay conexión con api.apify.com. Revisa la red.";
  return `No se pudo consultar Apify: ${msg}`;
}

/** POST /api/ajustes/apify/probar → `{ ok, ciclo, mensual }` con el token guardado. */
export async function POST(): Promise<Response> {
  const token = leerSecrets().apifyToken;
  if (!token) return errorJson("No hay token de Apify configurado.", 409);
  try {
    const limites = await consultarLimites(token);
    guardarCacheUso({ muestreadoEn: new Date().toISOString(), tokenHuella: huellaToken(token), limites });
    return okJson({ ok: true, ciclo: limites.ciclo, mensual: limites.mensual });
  } catch (e) {
    return okJson({ ok: false, error: describirFallo(e) }, 502);
  }
}
