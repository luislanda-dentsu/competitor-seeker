import { connection } from "next/server";
import { contarNoLeidas, listarNotificaciones } from "@competitor-seeker/core";
import { okJson } from "@/lib/settings/api";

/** GET /api/notificaciones[?noLeidas=1&limite=50] → `{ notificaciones, noLeidas }`. */
export async function GET(request: Request): Promise<Response> {
  await connection();
  const params = new URL(request.url).searchParams;
  const noLeidas = params.get("noLeidas") === "1";
  const limiteCrudo = Number(params.get("limite") ?? "50");
  const limite = Number.isFinite(limiteCrudo) && limiteCrudo > 0 ? Math.min(limiteCrudo, 500) : 50;
  return okJson({ notificaciones: listarNotificaciones({ noLeidas, limite }), noLeidas: contarNoLeidas() });
}
