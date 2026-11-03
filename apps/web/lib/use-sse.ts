"use client";

import { useEffect, useReducer, useRef } from "react";
import type { EventoCorrida } from "@competitor-seeker/core";
import {
  cerrarConsola,
  estadoInicial,
  reducirConsola,
  type EstadoConsola,
  type ResumenFin,
} from "@/lib/runs/consola";
import { rutaApiCorrida } from "@/lib/runs/tipos";

export type ConexionSSE = "inactiva" | "conectando" | "conectada" | "reconectando" | "cerrada";

/** Reconexiones consecutivas (sin recibir nada) antes de rendirse. */
export const MAX_REINTENTOS_SSE = 6;

export interface EstadoStream {
  consola: EstadoConsola;
  conexion: ConexionSSE;
  /** Último `id` recibido (offset en bytes), para reconectar por `Last-Event-ID`. */
  ultimoId: string;
  /** Motivo por el que la conexión se cerró sin `fin` (tope de reintentos, corrida desaparecida). */
  error: string | null;
}

type Accion =
  | { tipo: "reset" }
  | { tipo: "conexion"; conexion: ConexionSSE }
  | { tipo: "evento"; evento: EventoCorrida; id: string }
  | { tipo: "fin"; fin: ResumenFin; id: string }
  | { tipo: "error"; mensaje: string };

function inicial(): EstadoStream {
  return { consola: estadoInicial(), conexion: "inactiva", ultimoId: "", error: null };
}

function reducer(estado: EstadoStream, a: Accion): EstadoStream {
  switch (a.tipo) {
    case "reset":
      return inicial();
    case "conexion":
      return { ...estado, conexion: a.conexion };
    case "evento":
      return { ...estado, consola: reducirConsola(estado.consola, a.evento), ultimoId: a.id || estado.ultimoId };
    case "fin":
      return { ...estado, consola: cerrarConsola(estado.consola, a.fin), conexion: "cerrada", ultimoId: a.id || estado.ultimoId };
    case "error":
      return { ...estado, conexion: "cerrada", error: a.mensaje };
    default:
      return estado;
  }
}

function parsear<T>(texto: string): T | null {
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

/**
 * Sigue `/api/corridas/<marca>/<id>/stream` por SSE. Si el servidor corta sin `fin`,
 * reconecta con backoff pasando el último id (`?desde=`); el navegador además
 * manda `Last-Event-ID` en sus reintentos automáticos. Antes de reabrir consulta
 * `GET /api/corridas/<marca>/<id>`: si la corrida ya cerró, termina con su resumen.
 * Tras `MAX_REINTENTOS_SSE` fallos seguidos pasa a `cerrada` con `error`.
 */
export function useCorridaStream(marca: string | null, corridaId: string | null): EstadoStream {
  const [estado, dispatch] = useReducer(reducer, undefined, inicial);
  const ultimoIdRef = useRef("");

  useEffect(() => {
    dispatch({ tipo: "reset" });
    ultimoIdRef.current = "";
    if (!marca || !corridaId) return;

    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let terminado = false;
    let intentos = 0;
    const base = rutaApiCorrida(marca, corridaId);

    const terminar = (accion: Accion) => {
      terminado = true;
      dispatch(accion);
      es?.close();
    };

    const abrir = () => {
      if (terminado) return;
      dispatch({ tipo: "conexion", conexion: intentos === 0 ? "conectando" : "reconectando" });
      const desde = ultimoIdRef.current;
      es = new EventSource(`${base}/stream${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`);
      es.onopen = () => {
        intentos = 0;
        dispatch({ tipo: "conexion", conexion: "conectada" });
      };
      es.onmessage = (m: MessageEvent<string>) => {
        const ev = parsear<EventoCorrida>(m.data);
        if (!ev) return;
        if (m.lastEventId) ultimoIdRef.current = m.lastEventId;
        dispatch({ tipo: "evento", evento: ev, id: m.lastEventId });
      };
      es.addEventListener("fin", (m: MessageEvent<string>) => {
        terminar({ tipo: "fin", fin: parsear<ResumenFin>(m.data) ?? {}, id: m.lastEventId });
      });
      es.onerror = () => {
        if (terminado) return;
        dispatch({ tipo: "conexion", conexion: "reconectando" });
        // CLOSED: el navegador no reintentará solo → lo hacemos nosotros con backoff y tope.
        if (!es || es.readyState !== EventSource.CLOSED) return;
        es.close();
        intentos += 1;
        if (intentos > MAX_REINTENTOS_SSE) {
          terminar({ tipo: "error", mensaje: `Sin conexión con el servidor tras ${MAX_REINTENTOS_SSE} reintentos; recarga la página para volver a seguir la corrida.` });
          return;
        }
        timer = setTimeout(() => void reabrir(), Math.min(1000 * 2 ** (intentos - 1), 10_000));
      };
    };

    /** Antes de reabrir: si la corrida ya cerró (o desapareció), no hay stream que seguir. */
    const reabrir = async () => {
      if (terminado) return;
      try {
        const res = await fetch(base, { cache: "no-store" });
        if (res.status === 404) {
          terminar({ tipo: "error", mensaje: "La corrida ya no existe en el servidor." });
          return;
        }
        if (res.ok) {
          const resumen = (await res.json()) as ResumenFin;
          if (resumen.estado && resumen.estado !== "en-curso") {
            terminar({ tipo: "fin", fin: resumen, id: ultimoIdRef.current });
            return;
          }
        }
      } catch {
        /* sin respuesta: se reintenta el stream igualmente */
      }
      abrir();
    };

    abrir();
    return () => {
      terminado = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, [marca, corridaId]);

  return estado;
}
