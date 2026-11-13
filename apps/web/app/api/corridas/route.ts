import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/sesion";
import { existeMarca } from "@competitor-seeker/core";
import { estimarHistorica } from "@/lib/runs/historica";
import { CorridaEnCurso, lanzarCorrida, type OpcionesLanzar } from "@/lib/runs/runner";

/**
 * POST /api/corridas `{ marca, incluirApify, ventana?: {desde, hasta}, topePosts? }` → `{ corridaId }` · 409 si hay una en curso.
 * Con `ventana` es una corrida histórica: el tope de posts de Apify nunca pasa del que calcula el servidor.
 */
export async function POST(request: Request): Promise<Response> {
  const usuario = await exigirUsuario();
  if (usuario instanceof Response) return usuario;
  let cuerpo: { marca?: unknown; incluirApify?: unknown; ventana?: unknown; topePosts?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const marca = typeof cuerpo.marca === "string" ? cuerpo.marca.trim() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(marca)) return NextResponse.json({ error: "Falta la marca (slug)" }, { status: 400 });
  if (!existeMarca(marca)) return NextResponse.json({ error: `La marca "${marca}" no existe` }, { status: 404 });
  const incluirApify = cuerpo.incluirApify === true;

  let historica: OpcionesLanzar["historica"];
  if (cuerpo.ventana !== undefined && cuerpo.ventana !== null) {
    const v = typeof cuerpo.ventana === "object" ? (cuerpo.ventana as { desde?: unknown; hasta?: unknown }) : {};
    const est = await estimarHistorica(marca, v);
    if (!est.ok) return NextResponse.json({ error: est.error }, { status: 400 });
    const pedido = typeof cuerpo.topePosts === "number" && Number.isInteger(cuerpo.topePosts) ? cuerpo.topePosts : est.estimacion.topePosts;
    historica = {
      ventana: { desde: v.desde as string, hasta: v.hasta as string },
      topePosts: Math.max(0, Math.min(pedido, est.estimacion.topePosts)),
    };
  }

  try {
    const r = await lanzarCorrida({ marca, incluirApify, ...(historica ? { historica } : {}) });
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
