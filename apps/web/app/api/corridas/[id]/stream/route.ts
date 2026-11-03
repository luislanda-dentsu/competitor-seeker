import { connection } from "next/server";
import { NextResponse } from "next/server";
import { buscarCorrida } from "@/lib/runs/consulta";
import { obtenerViva } from "@/lib/runs/registro";
import { resumenDeCorrida } from "@/lib/runs/resumen";
import { esIdCorridaValido, rutaFinStream, rutaStream } from "@/lib/runs/rutas";
import { crearStreamSSE, parsearLastEventId } from "@/lib/sse";

type Ctx = { params: Promise<{ id: string }> };

const CABECERAS_SSE = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * GET /api/corridas/[id]/stream → SSE. Reanuda desde `Last-Event-ID` (o `?desde=`),
 * sigue el archivo y emite `event: fin` con el resumen de la corrida ya cerrada.
 */
export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  await connection();
  const { id } = await params;
  if (!esIdCorridaValido(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  const corrida = buscarCorrida(id);
  if (!corrida) return NextResponse.json({ error: `No existe la corrida ${id}` }, { status: 404 });

  const url = new URL(request.url);
  const desde = parsearLastEventId(request.headers.get("last-event-id") ?? url.searchParams.get("desde"));
  const marca = corrida.marca;

  // El runner cierra la corrida justo después de crear `.fin`: esperamos (≤ 10 s) a que deje de estar en curso.
  const datosFin = async () => {
    for (let i = 0; i < 40; i++) {
      const actual = buscarCorrida(id, marca);
      if (actual && actual.estado !== "en-curso") return resumenDeCorrida(actual);
      await dormir(250);
    }
    const actual = buscarCorrida(id, marca);
    return actual ? resumenDeCorrida(actual) : { corridaId: id, estado: "en-curso" };
  };
  // Sin archivo de stream y sin proceso vivo: no hay nada que seguir.
  const abandonada = () => {
    const actual = buscarCorrida(id, marca);
    return !obtenerViva(id) && (!actual || actual.estado !== "en-curso");
  };

  const stream = crearStreamSSE({
    ruta: rutaStream(id),
    rutaFin: rutaFinStream(id),
    desde,
    signal: request.signal,
    datosFin,
    abandonada,
  });
  return new Response(stream, { headers: CABECERAS_SSE });
}
