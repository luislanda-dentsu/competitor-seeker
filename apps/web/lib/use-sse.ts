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

export type ConexionSSE = "inactiva" | "conectando" | "conectada" | "reconectando" | "cerrada";

export interface EstadoStream {
  consola: EstadoConsola;
  conexion: ConexionSSE;
  /** Último `id` recibido (offset en bytes), para reconectar por `Last-Event-ID`. */
  ultimoId: string;
}

type Accion =
  | { tipo: "reset" }
  | { tipo: "conexion"; conexion: ConexionSSE }
  | { tipo: "evento"; evento: EventoCorrida; id: string }
  | { tipo: "fin"; fin: ResumenFin; id: string };

function reducer(estado: EstadoStream, a: Accion): EstadoStream {
  switch (a.tipo) {
    case "reset":
      return { consola: estadoInicial(), conexion: "inactiva", ultimoId: "" };
    case "conexion":
      return { ...estado, conexion: a.conexion };
    case "evento":
      return { ...estado, consola: reducirConsola(estado.consola, a.evento), ultimoId: a.id || estado.ultimoId };
    case "fin":
      return { consola: cerrarConsola(estado.consola, a.fin), conexion: "cerrada", ultimoId: a.id || estado.ultimoId };
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
 * Sigue `/api/corridas/<id>/stream` por SSE. Si el servidor corta sin `fin`,
 * reconecta con backoff pasando el último id (`?desde=`); el navegador además
 * manda `Last-Event-ID` en sus reintentos automáticos. Al recibir `fin` cierra.
 */
export function useCorridaStream(corridaId: string | null): EstadoStream {
  const [estado, dispatch] = useReducer(reducer, undefined, () => ({ consola: estadoInicial(), conexion: "inactiva" as ConexionSSE, ultimoId: "" }));
  const ultimoIdRef = useRef("");

  useEffect(() => {
    dispatch({ tipo: "reset" });
    ultimoIdRef.current = "";
    if (!corridaId) return;

    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let terminado = false;
    let intentos = 0;

    const abrir = () => {
      if (terminado) return;
      dispatch({ tipo: "conexion", conexion: intentos === 0 ? "conectando" : "reconectando" });
      const desde = ultimoIdRef.current;
      const url = `/api/corridas/${encodeURIComponent(corridaId)}/stream${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`;
      es = new EventSource(url);
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
        terminado = true;
        const fin = parsear<ResumenFin>(m.data) ?? {};
        dispatch({ tipo: "fin", fin, id: m.lastEventId });
        es?.close();
      });
      es.onerror = () => {
        if (terminado) return;
        // CLOSED: el navegador no reintentará solo → lo hacemos nosotros con backoff.
        if (es && es.readyState === EventSource.CLOSED) {
          es.close();
          const espera = Math.min(1000 * 2 ** intentos, 10_000);
          intentos += 1;
          dispatch({ tipo: "conexion", conexion: "reconectando" });
          timer = setTimeout(abrir, espera);
        } else {
          dispatch({ tipo: "conexion", conexion: "reconectando" });
        }
      };
    };

    abrir();
    return () => {
      terminado = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, [corridaId]);

  return estado;
}
