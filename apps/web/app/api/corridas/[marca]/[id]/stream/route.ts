import fs from "node:fs";
import { connection } from "next/server";
import { NextResponse } from "next/server";
import { buscarCorrida } from "@/lib/runs/consulta";
import { obtenerViva } from "@/lib/runs/registro";
import { resumenDeCorrida } from "@/lib/runs/resumen";
import { reconciliarHuerfanas } from "@/lib/runs/runner";
import { esIdCorridaValido, esSlugMarcaValido, rutaFinStream, rutaStream } from "@/lib/runs/rutas";
import { crearStreamSSE, formatearSSE, parsearLastEventId, trozoDesde } from "@/lib/sse";

type Ctx = { params: Promise<{ marca: string; id: string }> };

const CABECERAS_SSE = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Reproduce lo grabado desde `desde` y cierra con `fin`: para corridas ya cerradas sin marcador `.fin`. */
function streamCerrado(ruta: string, desde: number, datos: unknown): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(`: conectado desde ${desde} (corrida cerrada)\n\n`));
      const t = trozoDesde(ruta, desde);
      for (const m of t.mensajes) controller.enqueue(enc.encode(m));
      controller.enqueue(enc.encode(formatearSSE(datos, t.offset, "fin")));
      controller.close();
    },
  });
}

/**
 * GET /api/corridas/[marca]/[id]/stream → SSE. Reanuda desde `Last-Event-ID` (o `?desde=`),
 * sigue el archivo y emite `event: fin` con el resumen de la corrida ya cerrada.
 * Una corrida que ya no está `en-curso` y no tiene `.fin` (servidor reiniciado,
 * cancelada huérfana) recibe `fin` de inmediato tras lo grabado.
 */
export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  await connection();
  const { marca, id } = await params;
  if (!esSlugMarcaValido(marca)) return NextResponse.json({ error: "Marca inválida" }, { status: 400 });
  if (!esIdCorridaValido(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  reconciliarHuerfanas();
  const corrida = buscarCorrida(marca, id);
  if (!corrida) return NextResponse.json({ error: `No existe la corrida ${id} de ${marca}` }, { status: 404 });

  const url = new URL(request.url);
  const desde = parsearLastEventId(request.headers.get("last-event-id") ?? url.searchParams.get("desde"));
  const ruta = rutaStream(marca, id);
  const rutaFin = rutaFinStream(marca, id);

  // El runner cierra la corrida justo después de crear `.fin`: esperamos (≤ 10 s) a que deje de estar en curso.
  const datosFin = async () => {
    for (let i = 0; i < 40; i++) {
      const actual = buscarCorrida(marca, id);
      if (actual && actual.estado !== "en-curso") return resumenDeCorrida(actual);
      await dormir(250);
    }
    const actual = buscarCorrida(marca, id);
    return actual ? resumenDeCorrida(actual) : { corridaId: id, marca, estado: "en-curso" };
  };
  // Sin proceso vivo y ya no en curso: no hay nada que seguir.
  const abandonada = () => {
    const actual = buscarCorrida(marca, id);
    return !obtenerViva(id) && (!actual || actual.estado !== "en-curso");
  };

  if (!fs.existsSync(rutaFin) && abandonada()) {
    return new Response(streamCerrado(ruta, desde, resumenDeCorrida(corrida)), { headers: CABECERAS_SSE });
  }

  const stream = crearStreamSSE({ ruta, rutaFin, desde, signal: request.signal, datosFin, abandonada });
  return new Response(stream, { headers: CABECERAS_SSE });
}
