import { NextResponse } from "next/server";
import { existeMarca } from "@competitor-seeker/core";
import { estimarHistorica } from "@/lib/runs/historica";

/** GET /api/corridas/estimacion?marca=&desde=&hasta= → posts y coste estimados de una corrida histórica. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const marca = url.searchParams.get("marca") ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(marca)) return NextResponse.json({ error: "Falta la marca (slug)" }, { status: 400 });
  if (!existeMarca(marca)) return NextResponse.json({ error: `La marca "${marca}" no existe` }, { status: 404 });
  const r = await estimarHistorica(marca, { desde: url.searchParams.get("desde"), hasta: url.searchParams.get("hasta") });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.estimacion, { headers: { "cache-control": "no-store" } });
}
