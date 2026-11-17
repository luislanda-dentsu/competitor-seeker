import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/sesion";
import { agruparPorFecha, existeMarca, listarChats } from "@competitor-seeker/core";

/** GET /api/asistente/chats?marca= → `{ chats, grupos }` (más recientes primero; grupos Hoy/Ayer/Últimos 7 días/Anteriores). */
export async function GET(request: Request): Promise<Response> {
  const usuario = await exigirUsuario();
  if (usuario instanceof Response) return usuario;
  const url = new URL(request.url);
  const marca = (url.searchParams.get("marca") ?? "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(marca)) return NextResponse.json({ error: "Falta la marca (slug)" }, { status: 400 });
  if (!existeMarca(marca)) return NextResponse.json({ error: `La marca "${marca}" no existe` }, { status: 404 });
  const chats = listarChats(marca);
  return NextResponse.json({ chats, grupos: agruparPorFecha(chats) }, { headers: { "cache-control": "no-store" } });
}
