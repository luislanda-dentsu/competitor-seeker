import { NextResponse } from "next/server";
import { buscarCorrida } from "@/lib/runs/consulta";
import { resumenDeCorrida } from "@/lib/runs/resumen";
import { cancelarCorrida } from "@/lib/runs/runner";
import { esIdCorridaValido } from "@/lib/runs/rutas";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/corridas/[id] → cancela (SIGTERM); la corrida queda `error: cancelada`. */
export async function DELETE(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!esIdCorridaValido(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  try {
    const r = await cancelarCorrida(id);
    if (!r) return NextResponse.json({ error: `La corrida ${id} no está en curso` }, { status: 409 });
    const corrida = buscarCorrida(id);
    return NextResponse.json({ ...r, corrida: corrida ? resumenDeCorrida(corrida) : null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** GET /api/corridas/[id] → resumen de la corrida (404 si no existe). */
export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!esIdCorridaValido(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  const corrida = buscarCorrida(id);
  if (!corrida) return NextResponse.json({ error: `No existe la corrida ${id}` }, { status: 404 });
  return NextResponse.json(resumenDeCorrida(corrida), { headers: { "cache-control": "no-store" } });
}
