import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/sesion";
import { buscarCorrida } from "@/lib/runs/consulta";
import { resumenDeCorrida } from "@/lib/runs/resumen";
import { cancelarCorrida } from "@/lib/runs/runner";
import { esIdCorridaValido, esSlugMarcaValido } from "@/lib/runs/rutas";

type Ctx = { params: Promise<{ marca: string; id: string }> };

function validar(marca: string, id: string): Response | null {
  if (!esSlugMarcaValido(marca)) return NextResponse.json({ error: "Marca inválida" }, { status: 400 });
  if (!esIdCorridaValido(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  return null;
}

/** DELETE /api/corridas/[marca]/[id] → cancela (SIGTERM al grupo, SIGKILL si no cede); la corrida queda `error: cancelada`. */
export async function DELETE(_request: Request, { params }: Ctx): Promise<Response> {
  const usuario = await exigirUsuario();
  if (usuario instanceof Response) return usuario;
  const { marca, id } = await params;
  const invalido = validar(marca, id);
  if (invalido) return invalido;
  try {
    const r = await cancelarCorrida(marca, id);
    if (!r) return NextResponse.json({ error: `La corrida ${id} de ${marca} no está en curso` }, { status: 409 });
    const corrida = buscarCorrida(marca, id);
    return NextResponse.json({ ...r, corrida: corrida ? resumenDeCorrida(corrida) : null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** GET /api/corridas/[marca]/[id] → resumen de la corrida (404 si no existe). */
export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const { marca, id } = await params;
  const invalido = validar(marca, id);
  if (invalido) return invalido;
  const corrida = buscarCorrida(marca, id);
  if (!corrida) return NextResponse.json({ error: `No existe la corrida ${id} de ${marca}` }, { status: 404 });
  return NextResponse.json(resumenDeCorrida(corrida), { headers: { "cache-control": "no-store" } });
}
