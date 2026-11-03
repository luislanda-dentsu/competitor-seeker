"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { leerSSE } from "@/lib/chat/sse-cliente";
import type { ArtefactoUi, ChatUi, EventoChat, Feedback, MensajeUi } from "@/lib/chat/tipos";

export type EstadoChat = "idle" | "thinking" | "streaming" | "error";

export interface EstadoStreamChat {
  chatId: string | null;
  titulo: string | null;
  mensajes: MensajeUi[];
  estado: EstadoChat;
  error: string | null;
  /** Texto del indicador ("Pensando…", "Leyendo log.jsonl…") mientras no llega texto. */
  pensando: string | null;
}

type Accion =
  | { tipo: "enviar"; mensaje: MensajeUi }
  | { tipo: "quitarUltimos"; n: number }
  | { tipo: "delta"; texto: string }
  | { tipo: "thinking"; activo: boolean; texto?: string }
  | { tipo: "artifact"; artefacto: ArtefactoUi }
  | { tipo: "done"; chatId: string; titulo: string }
  | { tipo: "error"; error: string }
  | { tipo: "detenido" }
  | { tipo: "feedback"; indice: number; feedback: Feedback | null }
  | { tipo: "cargar"; chat: ChatUi | null };

function ultimoAsistente(mensajes: MensajeUi[], fn: (m: MensajeUi) => MensajeUi): MensajeUi[] {
  const i = mensajes.length - 1;
  const m = mensajes[i];
  if (!m || m.rol !== "asistente") return mensajes;
  return [...mensajes.slice(0, i), fn(m)];
}

/** Quita un placeholder de asistente vacío al final (tras error o cancelación sin texto). */
function sinPlaceholderVacio(mensajes: MensajeUi[]): MensajeUi[] {
  const m = mensajes.at(-1);
  return m && m.rol === "asistente" && m.texto === "" && !m.artefacto ? mensajes.slice(0, -1) : mensajes;
}

function reducer(e: EstadoStreamChat, a: Accion): EstadoStreamChat {
  switch (a.tipo) {
    case "cargar":
      return {
        chatId: a.chat?.id ?? null,
        titulo: a.chat?.titulo ?? null,
        mensajes: a.chat?.mensajes ?? [],
        estado: "idle",
        error: null,
        pensando: null,
      };
    case "enviar":
      return {
        ...e,
        mensajes: [...e.mensajes, a.mensaje, { rol: "asistente", texto: "", ts: a.mensaje.ts }],
        estado: "thinking",
        error: null,
        pensando: "Pensando…",
      };
    case "quitarUltimos":
      return { ...e, mensajes: e.mensajes.slice(0, Math.max(0, e.mensajes.length - a.n)), error: null, estado: "idle" };
    case "delta":
      return { ...e, estado: "streaming", pensando: null, mensajes: ultimoAsistente(e.mensajes, (m) => ({ ...m, texto: m.texto + a.texto })) };
    case "thinking":
      return { ...e, pensando: a.activo ? (a.texto ?? "Pensando…") : null };
    case "artifact":
      return { ...e, mensajes: ultimoAsistente(e.mensajes, (m) => ({ ...m, artefacto: a.artefacto })) };
    case "done":
      return { ...e, chatId: a.chatId, titulo: a.titulo, estado: "idle", pensando: null };
    case "error":
      return { ...e, estado: "error", error: a.error, pensando: null, mensajes: sinPlaceholderVacio(e.mensajes) };
    case "detenido":
      return { ...e, estado: "idle", pensando: null, mensajes: sinPlaceholderVacio(e.mensajes) };
    case "feedback":
      return {
        ...e,
        mensajes: e.mensajes.map((m, i) => {
          if (i !== a.indice) return m;
          const resto = { ...m };
          delete resto.feedback;
          return a.feedback ? { ...resto, feedback: a.feedback } : resto;
        }),
      };
    default:
      return e;
  }
}

export interface OpcionesChatStream {
  marca: string;
  /** Chat existente a cargar (null = chat nuevo). */
  chat: ChatUi | null;
  /** Al terminar un turno: `nuevo` si el chat acaba de crearse. */
  onDone?: (info: { chatId: string; titulo: string; nuevo: boolean }) => void;
  onArtefacto?: (artefacto: ArtefactoUi) => void;
}

export interface ChatStream extends EstadoStreamChat {
  generando: boolean;
  enviar: (texto: string) => void;
  detener: () => void;
  /** Vuelve a enviar la última pregunta (tras un error). */
  reintentar: () => void;
  /** Regenera la última respuesta del asistente. */
  regenerar: () => void;
  setFeedback: (indice: number, feedback: Feedback | null) => Promise<void>;
}

function parsear(datos: string): Record<string, unknown> | null {
  try {
    return JSON.parse(datos) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Conversación con `POST /api/asistente` por SSE. Los `delta` se acumulan y se
 * vuelcan al estado una vez por frame (rAF) para no re-renderizar por token.
 */
export function useChatStream(o: OpcionesChatStream): ChatStream {
  const [estado, dispatch] = useReducer(reducer, o.chat, (chat) => reducer({} as EstadoStreamChat, { tipo: "cargar", chat }));
  const abortRef = useRef<AbortController | null>(null);
  const pendienteRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const ultimaPreguntaRef = useRef<string | null>(null);
  const chatIdRef = useRef<string | null>(o.chat?.id ?? null);
  const onDoneRef = useRef(o.onDone);
  const onArtefactoRef = useRef(o.onArtefacto);
  useEffect(() => {
    onDoneRef.current = o.onDone;
    onArtefactoRef.current = o.onArtefacto;
  });

  const vaciar = useCallback(() => {
    rafRef.current = null;
    if (pendienteRef.current === "") return;
    const texto = pendienteRef.current;
    pendienteRef.current = "";
    dispatch({ tipo: "delta", texto });
  }, []);

  const encolarDelta = useCallback(
    (texto: string) => {
      pendienteRef.current += texto;
      if (rafRef.current !== null) return;
      if (typeof requestAnimationFrame === "function") rafRef.current = requestAnimationFrame(vaciar);
      else vaciar();
    },
    [vaciar],
  );

  const detener = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const lanzar = useCallback(
    async (texto: string, regenerar: boolean) => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      ultimaPreguntaRef.current = texto;
      dispatch({ tipo: "enviar", mensaje: { rol: "usuario", texto, ts: new Date().toISOString() } });

      const nuevo = chatIdRef.current === null;
      let terminado = false;
      try {
        const res = await fetch("/api/asistente", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ marca: o.marca, mensaje: texto, chatId: chatIdRef.current ?? undefined, regenerar }),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(cuerpo.error ?? `Error ${res.status}`);
        }
        for await (const trama of leerSSE(res.body)) {
          const datos = parsear(trama.datos);
          if (!datos) continue;
          const ev = { tipo: trama.evento, ...datos } as EventoChat;
          switch (ev.tipo) {
            case "delta":
              encolarDelta(ev.texto);
              break;
            case "thinking":
              vaciar();
              dispatch({ tipo: "thinking", activo: ev.activo, texto: ev.texto });
              break;
            case "artifact":
              vaciar();
              dispatch({ tipo: "artifact", artefacto: ev.artefacto });
              onArtefactoRef.current?.(ev.artefacto);
              break;
            case "done":
              vaciar();
              terminado = true;
              chatIdRef.current = ev.chatId;
              dispatch({ tipo: "done", chatId: ev.chatId, titulo: ev.titulo });
              onDoneRef.current?.({ chatId: ev.chatId, titulo: ev.titulo, nuevo });
              break;
            case "error":
              vaciar();
              terminado = true;
              dispatch({ tipo: "error", error: ev.error });
              break;
            default:
              break;
          }
        }
        vaciar();
        if (!terminado) dispatch({ tipo: "error", error: "La conexión se cerró sin respuesta." });
      } catch (e) {
        vaciar();
        if (ctl.signal.aborted) dispatch({ tipo: "detenido" });
        else dispatch({ tipo: "error", error: (e as Error).message });
      } finally {
        if (abortRef.current === ctl) abortRef.current = null;
      }
    },
    [o.marca, encolarDelta, vaciar],
  );

  const enviar = useCallback(
    (texto: string) => {
      const t = texto.trim();
      if (t === "") return;
      void lanzar(t, false);
    },
    [lanzar],
  );

  const reintentar = useCallback(() => {
    const t = ultimaPreguntaRef.current;
    if (!t) return;
    // El turno fallido no se guardó: quitamos la pregunta local y la repetimos.
    const ultimo = estado.mensajes.at(-1);
    if (ultimo?.rol === "usuario" && ultimo.texto === t) dispatch({ tipo: "quitarUltimos", n: 1 });
    void lanzar(t, false);
  }, [estado.mensajes, lanzar]);

  const regenerar = useCallback(() => {
    const m = estado.mensajes;
    const ultimo = m.at(-1);
    const previo = m.at(-2);
    if (!ultimo || ultimo.rol !== "asistente" || !previo || previo.rol !== "usuario") return;
    dispatch({ tipo: "quitarUltimos", n: 2 });
    void lanzar(previo.texto, true);
  }, [estado.mensajes, lanzar]);

  const setFeedback = useCallback(
    async (indice: number, feedback: Feedback | null) => {
      const chatId = chatIdRef.current;
      dispatch({ tipo: "feedback", indice, feedback });
      if (!chatId) return;
      await fetch("/api/asistente", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marca: o.marca, chatId, indice, feedback }),
      }).catch(() => undefined);
    },
    [o.marca],
  );

  return {
    ...estado,
    generando: estado.estado === "thinking" || estado.estado === "streaming",
    enviar,
    detener,
    reintentar,
    regenerar,
    setFeedback,
  };
}
