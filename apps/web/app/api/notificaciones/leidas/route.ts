import { marcarTodasLeidas } from "@competitor-seeker/core";
import { exigirUsuario } from "@/lib/sesion";
import { okJson } from "@/lib/settings/api";

/** POST /api/notificaciones/leidas → marca todas como leídas; `{ ok, marcadas }`. */
export async function POST(): Promise<Response> {
  const usuario = await exigirUsuario();
  if (usuario instanceof Response) return usuario;
  return okJson({ ok: true, marcadas: marcarTodasLeidas() });
}
