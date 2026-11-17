import { connection } from "next/server";
import { errorJson, okJson } from "@/lib/settings/api";
import { usuarioActual } from "@/lib/sesion";

/** GET /api/sesion → `{ email, rol, nombre, imagen }` del usuario actual (401 sin sesión). */
export async function GET(): Promise<Response> {
  await connection();
  const u = await usuarioActual();
  return u ? okJson(u) : errorJson("Inicia sesión", 401);
}
