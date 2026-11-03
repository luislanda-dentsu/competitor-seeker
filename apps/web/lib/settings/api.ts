// Solo servidor: utilidades mínimas para las rutas API de Ajustes.
import { NextResponse } from "next/server";
import type { z } from "zod";
import { primerError } from "@/lib/settings/validacion";

export const SIN_CACHE = { "cache-control": "no-store" } as const;

export function errorJson(mensaje: string, status: number): Response {
  return NextResponse.json({ error: mensaje }, { status, headers: SIN_CACHE });
}

export function okJson(cuerpo: unknown, status: number = 200): Response {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE });
}

/** Parsea y valida el cuerpo JSON; devuelve `{ datos }` o `{ respuesta }` (400). */
export async function leerCuerpo<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ datos: z.infer<S>; respuesta?: undefined } | { datos?: undefined; respuesta: Response }> {
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return { respuesta: errorJson("JSON inválido", 400) };
  }
  const res = schema.safeParse(crudo);
  if (!res.success) return { respuesta: errorJson(primerError(res.error), 400) };
  return { datos: res.data as z.infer<S> };
}
