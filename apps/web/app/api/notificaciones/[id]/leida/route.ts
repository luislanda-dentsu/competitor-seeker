import { contarNoLeidas, marcarLeida } from "@competitor-seeker/core";
import { errorJson, okJson } from "@/lib/settings/api";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/notificaciones/[id]/leida → `{ ok, noLeidas }` · 404 si no existe. */
export async function POST(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return errorJson("Id inválido", 400);
  if (!marcarLeida(id)) return errorJson(`No existe la notificación ${id}`, 404);
  return okJson({ ok: true, noLeidas: contarNoLeidas() });
}
