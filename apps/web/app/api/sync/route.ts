import { connection } from "next/server";
import { z } from "zod";
import { commitYPush, estadoSync, pull } from "@competitor-seeker/core";
import { errorJson, leerCuerpo, okJson } from "@/lib/settings/api";

const CuerpoSync = z.object({ accion: z.enum(["pull", "push"]) });

/** GET /api/sync → `EstadoSync` (remoto, rama, adelante/atrás, sucio, último pull/push, conflicto, error). */
export async function GET(): Promise<Response> {
  await connection();
  return okJson(await estadoSync());
}

/** POST /api/sync `{ accion: 'pull' | 'push' }` → resultado + estado actualizado. Siempre manual. */
export async function POST(request: Request): Promise<Response> {
  const { datos, respuesta } = await leerCuerpo(request, CuerpoSync);
  if (respuesta) return respuesta;
  try {
    const resultado = datos.accion === "pull" ? await pull() : await commitYPush("sync manual");
    return okJson({ resultado, estado: await estadoSync() });
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}
