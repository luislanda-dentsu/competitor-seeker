import { marcarTodasLeidas } from "@competitor-seeker/core";
import { okJson } from "@/lib/settings/api";

/** POST /api/notificaciones/leidas → marca todas como leídas; `{ ok, marcadas }`. */
export async function POST(): Promise<Response> {
  return okJson({ ok: true, marcadas: marcarTodasLeidas() });
}
