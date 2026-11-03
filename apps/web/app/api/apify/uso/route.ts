import { connection } from "next/server";
import { evaluarUmbralesApify, leerConfig, obtenerUsoActual } from "@competitor-seeker/core";
import { okJson } from "@/lib/settings/api";

/**
 * GET /api/apify/uso[?forzar=1] → `{ configurado, uso?, decision, muestreadoEn?, error? }`.
 * Sin token: `{ configurado: false, decision }`. Tras calcular el uso evalúa
 * los umbrales y emite las notificaciones que toquen (una vez por periodo).
 */
export async function GET(request: Request): Promise<Response> {
  await connection();
  const forzar = new URL(request.url).searchParams.get("forzar") === "1";
  const estado = await obtenerUsoActual({ forzar });
  if (estado.uso) {
    try {
      evaluarUmbralesApify(estado.uso, leerConfig().apify);
    } catch {
      /* las notificaciones nunca rompen la lectura del uso */
    }
  }
  return okJson(estado);
}
