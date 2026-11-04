import { NextResponse } from "next/server";
import { borrarChat, esIdChatValido, existeMarca, guardarChat, leerChat, listarMarcas } from "@competitor-seeker/core";
import { ChatNoEncontrado, ChatOcupado, responderChat, validarMensaje } from "@/lib/chat/runner";

const CABECERAS_SSE = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugValido(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return RE_SLUG.test(s) ? s : null;
}

/** Marca de un chat cuando no la indican: la primera que lo tenga. */
function marcaDelChat(chatId: string): string | null {
  for (const m of listarMarcas()) {
    try {
      if (leerChat(m.slug, chatId)) return m.slug;
    } catch {
      /* archivo roto: seguimos */
    }
  }
  return null;
}

/**
 * POST /api/asistente `{ marca, mensaje, chatId?, regenerar? }` → SSE
 * (`delta` · `thinking` · `artifact` · `done` · `error`). Si el cliente cierra
 * la conexión, el proceso `claude` recibe SIGTERM.
 */
export async function POST(request: Request): Promise<Response> {
  let cuerpo: { marca?: unknown; mensaje?: unknown; chatId?: unknown; regenerar?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const marca = slugValido(cuerpo.marca);
  if (!marca) return NextResponse.json({ error: "Falta la marca (slug)" }, { status: 400 });
  if (!existeMarca(marca)) return NextResponse.json({ error: `La marca "${marca}" no existe` }, { status: 404 });
  const mensaje = validarMensaje(cuerpo.mensaje);
  if (!mensaje) return NextResponse.json({ error: "Falta el mensaje (máx. 4000 caracteres)" }, { status: 400 });
  const chatId = typeof cuerpo.chatId === "string" && cuerpo.chatId !== "" ? cuerpo.chatId : undefined;
  if (chatId && !esIdChatValido(chatId)) return NextResponse.json({ error: "chatId inválido" }, { status: 400 });

  try {
    const stream = responderChat({ marca, mensaje, chatId, regenerar: cuerpo.regenerar === true, signal: request.signal });
    return new Response(stream, { headers: CABECERAS_SSE });
  } catch (e) {
    if (e instanceof ChatNoEncontrado) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof ChatOcupado) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** DELETE /api/asistente?chatId=&marca= → `{ borrado }`. */
export async function DELETE(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const chatId = url.searchParams.get("chatId") ?? "";
  if (!esIdChatValido(chatId)) return NextResponse.json({ error: "chatId inválido" }, { status: 400 });
  const marca = slugValido(url.searchParams.get("marca")) ?? marcaDelChat(chatId);
  if (!marca) return NextResponse.json({ error: `No existe el chat ${chatId}` }, { status: 404 });
  try {
    const borrado = borrarChat(marca, chatId);
    if (!borrado) return NextResponse.json({ error: `No existe el chat ${chatId}` }, { status: 404 });
    return NextResponse.json({ borrado: true, chatId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** PATCH /api/asistente `{ marca, chatId, indice, feedback: 'up'|'down'|null }` → guarda el feedback del mensaje. */
export async function PATCH(request: Request): Promise<Response> {
  let cuerpo: { marca?: unknown; chatId?: unknown; indice?: unknown; feedback?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const chatId = typeof cuerpo.chatId === "string" ? cuerpo.chatId : "";
  if (!esIdChatValido(chatId)) return NextResponse.json({ error: "chatId inválido" }, { status: 400 });
  const marca = slugValido(cuerpo.marca) ?? marcaDelChat(chatId);
  if (!marca) return NextResponse.json({ error: `No existe el chat ${chatId}` }, { status: 404 });
  const indice = typeof cuerpo.indice === "number" && Number.isInteger(cuerpo.indice) ? cuerpo.indice : -1;
  const feedback: "up" | "down" | null | undefined =
    cuerpo.feedback === "up" || cuerpo.feedback === "down" ? cuerpo.feedback : cuerpo.feedback === null ? null : undefined;
  if (feedback === undefined) return NextResponse.json({ error: "feedback debe ser 'up', 'down' o null" }, { status: 400 });

  try {
    const chat = leerChat(marca, chatId);
    const mensaje = chat?.mensajes[indice];
    if (!chat || !mensaje) return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
    if (mensaje.rol !== "asistente") return NextResponse.json({ error: "Solo se valora al asistente" }, { status: 400 });
    const mensajes = chat.mensajes.map((m, i) => {
      if (i !== indice) return m;
      const resto = { ...m };
      delete resto.feedback;
      return feedback ? { ...resto, feedback } : resto;
    });
    guardarChat({ ...chat, mensajes });
    return NextResponse.json({ chatId, indice, feedback });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
