import { NextResponse } from "next/server";
import { confirmarCorrida } from "@/lib/runs/confirmar";
import { buscarCorrida } from "@/lib/runs/consulta";
import { esIdCorridaValido, esSlugMarcaValido } from "@/lib/runs/rutas";

type Ctx = { params: Promise<{ marca: string; id: string }> };

/** POST /api/corridas/[marca]/[id]/confirmar `{ accion: 'registrar' | 'descartar' }` → vía `scripts/cs confirmar`. */
export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { marca, id } = await params;
  if (!esSlugMarcaValido(marca)) return NextResponse.json({ error: "Marca inválida" }, { status: 400 });
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
  const corrida = buscarCorrida(marca, id);
  if (!corrida) return NextResponse.json({ error: `No existe la corrida ${id} de ${marca}` }, { status: 404 });
  if (corrida.estado !== "pendiente-confirmacion") {
    return NextResponse.json({ error: `La corrida está en estado "${corrida.estado}", no pendiente-confirmacion` }, { status: 409 });
  }
  try {
    const r = await confirmarCorrida(marca, id, accion);
    return NextResponse.json(r);
  } catch (e) {
    // El CLI responde con CorridaBloqueada si otra confirmación va a la vez: 409, no 500.
    const mensaje = (e as Error).message;
    return NextResponse.json({ error: mensaje }, { status: /Otra operación/.test(mensaje) ? 409 : 500 });
  }
}
