// Solo servidor (Node): un turno del asistente = un `claude -p` (primer turno
// con contexto y `--session-id`; siguientes con `--resume`). Mismo patrón que
// el runner de corridas: `lanzarClaude` + volcado a archivo + SSE. Aquí el SSE
// sale directo por la respuesta del POST (no hay GET de reconexión: un turno
// abortado se guarda con el texto parcial).
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  allowedToolsAsistente,
  disallowedToolsAsistente,
  guardarChat,
  lanzarClaude,
  leerChat,
  nuevoChat,
  promptAsistente,
  rutaDataArchivo,
  type Chat,
  type EventoStream,
  type MensajeChat,
} from "@competitor-seeker/core";
import { ParserArtefactos, type SalidaParser } from "@/lib/chat/artifacts";
import { construirContexto } from "@/lib/chat/contexto";
import { indiceLog, resolverArtefacto, type IndiceLog } from "@/lib/chat/resolver";
import type { ArtefactoUi, EventoChat } from "@/lib/chat/tipos";
import { formatearSSE } from "@/lib/sse";

/** Ya hay un turno en curso para ese chat. */
export class ChatOcupado extends Error {
  constructor(id: string) {
    super(`El chat ${id} ya está respondiendo; espera o detén el turno actual`);
    this.name = "ChatOcupado";
  }
}

const enVuelo: Set<string> = ((globalThis as { __csChatsEnVuelo?: Set<string> }).__csChatsEnVuelo ??= new Set());

export class ChatNoEncontrado extends Error {
  constructor(id: string) {
    super(`No existe el chat ${id}`);
    this.name = "ChatNoEncontrado";
  }
}

export interface OpcionesResponder {
  marca: string;
  chatId?: string;
  mensaje: string;
  /** Repite el último turno: descarta la última respuesta antes de volver a preguntar. */
  regenerar?: boolean;
  signal?: AbortSignal;
}

/** Stream crudo de los turnos de un chat: `data/chats-vivos/<chatId>.stream.jsonl`. */
export function rutaStreamChat(chatId: string): string {
  return rutaDataArchivo("chats-vivos", `${chatId}.stream.jsonl`);
}

/** Prepara el chat (nuevo o existente) con el mensaje del usuario como último turno. */
function prepararChat(o: OpcionesResponder, ahora: Date): Chat {
  if (!o.chatId) return nuevoChat(o.marca, o.mensaje, { ahora });
  const chat = leerChat(o.marca, o.chatId);
  if (!chat) throw new ChatNoEncontrado(o.chatId);
  const mensajes = [...chat.mensajes];
  if (o.regenerar) {
    // Quita la última respuesta y la pregunta que la originó (se vuelve a añadir abajo).
    if (mensajes.at(-1)?.rol === "asistente") mensajes.pop();
    if (mensajes.at(-1)?.rol === "usuario" && mensajes.at(-1)?.texto === o.mensaje) mensajes.pop();
  }
  mensajes.push({ rol: "usuario", texto: o.mensaje, ts: ahora.toISOString() });
  return { ...chat, mensajes };
}

function etiquetaTool(nombre: string | undefined, input: Record<string, unknown> | undefined): string {
  if (nombre === "Read" && typeof input?.file_path === "string") return `Leyendo ${path.basename(input.file_path)}…`;
  if (nombre === "Grep" && typeof input?.pattern === "string") return `Buscando «${String(input.pattern).slice(0, 40)}»…`;
  return nombre ? `Usando ${nombre}…` : "Pensando…";
}

/** Última línea `cs_stderr`/`cs_error` del volcado (detalle de un fallo sin `result`). */
function detalleDelVolcado(ruta: string): string {
  try {
    const lineas = fs.readFileSync(ruta, "utf8").split("\n").filter((l) => l.includes('"cs_stderr"') || l.includes('"cs_error"'));
    const ultima = lineas.at(-1);
    if (!ultima) return "";
    const ev = JSON.parse(ultima) as { texto?: string };
    return (ev.texto ?? "").trim().split("\n").slice(-3).join(" ").slice(0, 400);
  } catch {
    return "";
  }
}

/**
 * Responde un turno y devuelve el cuerpo SSE. Eventos: `delta`, `thinking`,
 * `artifact`, `done`, `error`. Guarda el chat al terminar (también si se
 * abortó con texto parcial). Lanza síncronamente si el chat no existe.
 */
export function responderChat(o: OpcionesResponder): ReadableStream<Uint8Array> {
  const ahora = new Date();
  if (o.chatId && enVuelo.has(o.chatId)) throw new ChatOcupado(o.chatId);
  const chat = prepararChat(o, ahora);
  const primerTurno = !chat.sessionId;
  // En turnos con --resume el texto va como argumento: el prefijo impide que un mensaje como
  // "--chrome" se interprete como flag del CLI.
  const prompt = primerTurno ? promptAsistente({ marca: o.marca, contexto: construirContexto(o.marca).texto, pregunta: o.mensaje }) : `Pregunta de la usuaria: ${o.mensaje}`;
  enVuelo.add(chat.id);
  // Primer intento: la sesión lleva el id del chat; si una sesión previa no llegó a iniciar, id nuevo.
  const sesionNueva = primerTurno ? (chat.mensajes.length === 1 ? chat.id : randomUUID()) : undefined;

  const enc = new TextEncoder();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (o.signal) {
    if (o.signal.aborted) onAbort();
    else o.signal.addEventListener("abort", onAbort, { once: true });
  }

  return new ReadableStream<Uint8Array>({
    start(ctl) {
      let id = 0;
      let cerrado = false;
      const enviar = (ev: EventoChat) => {
        if (cerrado) return;
        const { tipo, ...datos } = ev;
        try {
          ctl.enqueue(enc.encode(formatearSSE(datos, ++id, tipo)));
        } catch {
          cerrado = true;
        }
      };
      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        try {
          ctl.close();
        } catch {
          /* ya cerrado */
        }
      };
      void ejecutar(enviar, cerrar).finally(() => enVuelo.delete(chat.id));
    },
    cancel() {
      controller.abort();
    },
  });

  async function ejecutar(enviar: (ev: EventoChat) => void, cerrar: () => void): Promise<void> {
    const volcado = rutaStreamChat(chat.id);
    const parser = new ParserArtefactos();
    // Estado mutado desde closures: en un objeto para que TS no lo estreche a `null`.
    const acc: { texto: string; artefacto: ArtefactoUi | null; indice: IndiceLog | null; sessionId: string | undefined; errorResult: string | null; huboTexto: boolean } = {
      texto: "",
      artefacto: null,
      indice: null,
      sessionId: chat.sessionId,
      errorResult: null,
      huboTexto: false,
    };

    const emitirSalida = (s: SalidaParser) => {
      if (s.texto) {
        if (!acc.huboTexto) {
          acc.huboTexto = true;
          enviar({ tipo: "thinking", activo: false });
        }
        acc.texto += s.texto;
        enviar({ tipo: "delta", texto: s.texto });
      }
      for (const a of s.artefactos) {
        if (acc.artefacto) continue; // un solo bloque por respuesta
        acc.indice ??= indiceLog(o.marca);
        acc.artefacto = resolverArtefacto(a.titulo, a.ids, acc.indice);
        enviar({ tipo: "artifact", artefacto: acc.artefacto });
      }
    };

    let proceso: ReturnType<typeof lanzarClaude>;
    try {
      proceso = lanzarClaude({
        prompt,
        agent: "asistente",
        ...(chat.sessionId ? { resume: chat.sessionId } : { sessionId: sesionNueva }),
        chrome: false,
        allowedTools: allowedToolsAsistente,
        disallowedTools: disallowedToolsAsistente,
        name: `asistente ${o.marca}`,
        volcarA: volcado,
        signal: controller.signal,
      });
    } catch (e) {
      enviar({ tipo: "error", error: (e as Error).message });
      cerrar();
      return;
    }

    enviar({ tipo: "thinking", activo: true });
    try {
      for await (const ev of proceso.eventos) procesar(ev);
    } catch {
      /* la cola se cierra sola */
    }
    emitirSalida(parser.fin());

    let code: number | null = null;
    try {
      const salida = await proceso.salida;
      code = salida.code;
      if (salida.sessionId) acc.sessionId = salida.sessionId;
      if (salida.isError && salida.resultado && !acc.errorResult) acc.errorResult = salida.resultado;
    } catch (e) {
      acc.errorResult = (e as Error).message;
    }

    const abortado = controller.signal.aborted;
    const textoFinal = acc.texto.trim();
    const art = acc.artefacto;
    const sessionId = acc.sessionId;
    const errorResult = acc.errorResult;
    if (textoFinal === "" && !art) {
      const detalle = errorResult || detalleDelVolcado(volcado);
      enviar({
        tipo: "error",
        error: abortado ? "Respuesta cancelada." : `El asistente no respondió${code !== null ? ` (código ${code})` : ""}${detalle ? `: ${detalle}` : "."}`,
      });
      cerrar();
      return;
    }

    const fin = new Date().toISOString();
    const respuesta: MensajeChat = {
      rol: "asistente",
      texto: abortado ? `${textoFinal}\n\n_(respuesta interrumpida)_` : textoFinal,
      ts: fin,
      ...(art ? { artefacto: { titulo: art.titulo, ids: art.ids } } : {}),
    };
    try {
      guardarChat({ ...chat, actualizado: fin, ...(primerTurno && !chat.contextoEn ? { contextoEn: ahora.toISOString() } : {}), ...(sessionId ? { sessionId } : {}), mensajes: [...chat.mensajes, respuesta] });
      if (errorResult && !abortado) enviar({ tipo: "error", error: errorResult });
      enviar({ tipo: "done", chatId: chat.id, titulo: chat.titulo, actualizado: fin });
    } catch (e) {
      enviar({ tipo: "error", error: `La respuesta no se pudo guardar: ${(e as Error).message}` });
    }
    cerrar();

    function procesar(ev: EventoStream): void {
      switch (ev.type) {
        case "system": {
          if (ev.subtype === "init" && typeof ev.session_id === "string") acc.sessionId = ev.session_id;
          return;
        }
        case "stream_event": {
          if (typeof ev.parent_tool_use_id === "string" && ev.parent_tool_use_id !== "") return;
          const evento = ev.event as
            | { type?: string; content_block?: { type?: string }; delta?: { type?: string; text?: string } }
            | undefined;
          if (evento?.type === "content_block_start") {
            if (evento.content_block?.type === "thinking") enviar({ tipo: "thinking", activo: true });
            else if (evento.content_block?.type === "text" && acc.texto !== "" && !acc.texto.endsWith("\n")) emitirSalida(parser.push("\n\n"));
          } else if (evento?.type === "content_block_delta" && evento.delta?.type === "text_delta" && evento.delta.text) {
            emitirSalida(parser.push(evento.delta.text));
          }
          return;
        }
        case "assistant": {
          const msg = ev.message as { content?: { type?: string; name?: string; input?: Record<string, unknown> }[] } | undefined;
          for (const b of msg?.content ?? []) {
            if (b.type === "tool_use") enviar({ tipo: "thinking", activo: true, texto: etiquetaTool(b.name, b.input) });
          }
          return;
        }
        case "result": {
          if (ev.is_error === true) acc.errorResult = typeof ev.result === "string" && ev.result.trim() ? ev.result.trim().slice(0, 500) : "Error del asistente";
          else if (typeof ev.subtype === "string" && ev.subtype !== "success" && ev.subtype !== "") {
            acc.errorResult = `El asistente terminó con estado ${ev.subtype}`;
          }
          return;
        }
        default:
          return;
      }
    }
  }
}

/** Mensaje del usuario válido: no vacío y acotado. */
export function validarMensaje(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "" || t.length > 4000) return null;
  return t;
}
