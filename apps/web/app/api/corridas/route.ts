import { NextResponse } from "next/server";
import { existeMarca } from "@competitor-seeker/core";
import { CorridaEnCurso, lanzarCorrida } from "@/lib/runs/runner";

/** POST /api/corridas `{ marca, incluirApify }` → `{ corridaId }` · 409 si hay una en curso. */
export async function POST(request: Request): Promise<Response> {
  let cuerpo: { marca?: unknown; incluirApify?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const marca = typeof cuerpo.marca === "string" ? cuerpo.marca.trim() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(marca)) return NextResponse.json({ error: "Falta la marca (slug)" }, { status: 400 });
  if (!existeMarca(marca)) return NextResponse.json({ error: `La marca "${marca}" no existe` }, { status: 404 });
  const incluirApify = cuerpo.incluirApify === true;

  try {
    const r = await lanzarCorrida({ marca, incluirApify });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof CorridaEnCurso) {
      return NextResponse.json(
        { error: e.message, enCurso: { corridaId: e.lock.corridaId, marca: e.lock.marca, inicio: e.lock.inicio } },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
