import { NextResponse } from "next/server";
import { confirmarCorrida } from "@/lib/runs/confirmar";
import { buscarCorrida } from "@/lib/runs/consulta";
import { esIdCorridaValido } from "@/lib/runs/rutas";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/corridas/[id]/confirmar `{ accion: 'registrar' | 'descartar' }` → vía `scripts/cs confirmar`. */
export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!esIdCorridaValido(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  let cuerpo: { accion?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const accion = cuerpo.accion;
  if (accion !== "registrar" && accion !== "descartar") {
    return NextResponse.json({ error: "accion debe ser registrar|descartar" }, { status: 400 });
  }
  const corrida = buscarCorrida(id);
  if (!corrida) return NextResponse.json({ error: `No existe la corrida ${id}` }, { status: 404 });
  if (corrida.estado !== "pendiente-confirmacion") {
    return NextResponse.json({ error: `La corrida está en estado "${corrida.estado}", no pendiente-confirmacion` }, { status: 409 });
  }
  try {
    const r = await confirmarCorrida(corrida.marca, id, accion);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
