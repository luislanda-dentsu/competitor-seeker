"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ChatResumenUi } from "@/lib/chat/tipos";

export type GrupoFecha = "Hoy" | "Ayer" | "Últimos 7 días" | "Anteriores";

export interface GrupoHistorial {
  grupo: GrupoFecha;
  chats: ChatResumenUi[];
}

/**
 * Versión global del historial: el chat la incrementa al terminar un turno o
 * al borrar, y el sidebar (otro árbol) vuelve a pedir la lista.
 */
let version = 0;
const listeners = new Set<() => void>();

export function invalidarHistorial(): void {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getVersion = () => version;
const getServerVersion = () => 0;

export interface Historial {
  grupos: GrupoHistorial[];
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

interface Cargado {
  /** `${marca}#${version}` que produjo estos datos: si no coincide con la actual, está cargando. */
  clave: string;
  grupos: GrupoHistorial[];
  error: string | null;
}

export function useHistorial(marca: string | null): Historial {
  const v = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const clave = marca ? `${marca}#${v}` : "";
  const [cargado, setCargado] = useState<Cargado>({ clave: "", grupos: [], error: null });

  useEffect(() => {
    if (!marca) return;
    let vivo = true;
    fetch(`/api/asistente/chats?marca=${encodeURIComponent(marca)}`, { cache: "no-store" })
      .then(async (res) => {
        const cuerpo = (await res.json().catch(() => ({}))) as { grupos?: GrupoHistorial[]; error?: string };
        if (!res.ok) throw new Error(cuerpo.error ?? `Error ${res.status}`);
        if (vivo) setCargado({ clave, grupos: cuerpo.grupos ?? [], error: null });
      })
      .catch((e: Error) => {
        if (vivo) setCargado((prev) => ({ clave, grupos: prev.grupos, error: e.message }));
      });
    return () => {
      vivo = false;
    };
  }, [marca, clave]);

  const recargar = useCallback(() => invalidarHistorial(), []);
  if (!marca) return { grupos: [], cargando: false, error: null, recargar };
  // Mientras llega la versión nueva se siguen mostrando los datos anteriores.
  return { grupos: cargado.grupos, cargando: cargado.clave !== clave, error: cargado.error, recargar };
}
