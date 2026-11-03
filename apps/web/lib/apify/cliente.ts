"use client";

// Cliente de `/api/apify/uso`: hook con refresco periódico y utilidades de
// presentación (tono por porcentaje). Solo tipos del core: nada de node aquí.
import { useCallback, useEffect, useRef, useState } from "react";
import type { EstadoUsoApify } from "@competitor-seeker/core/apify/actual";

export type { EstadoUsoApify };

export const INTERVALO_USO_MS = 5 * 60 * 1000;

export type TonoUso = "ok" | "aviso" | "critico";

/** ≥90 rojo, ≥70 ámbar, resto neutro (tokens de señal). */
export function tonoPct(pct: number): TonoUso {
  if (pct >= 90) return "critico";
  if (pct >= 70) return "aviso";
  return "ok";
}

export async function fetchUsoApify(forzar: boolean = false, signal?: AbortSignal): Promise<EstadoUsoApify> {
  const res = await fetch(`/api/apify/uso${forzar ? "?forzar=1" : ""}`, { cache: "no-store", signal });
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(cuerpo.error ?? `Error ${res.status}`);
  }
  return (await res.json()) as EstadoUsoApify;
}

export interface UsoApifyHook {
  estado: EstadoUsoApify | null;
  cargando: boolean;
  error: string | null;
  recargar: (forzar?: boolean) => Promise<void>;
}

/** Carga el uso al montar y cada `intervaloMs`; `recargar(true)` salta la caché del servidor. */
export function useUsoApify(intervaloMs: number = INTERVALO_USO_MS): UsoApifyHook {
  const [estado, setEstado] = useState<EstadoUsoApify | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);

  const recargar = useCallback(async (forzar: boolean = false) => {
    try {
      const r = await fetchUsoApify(forzar);
      if (!vivo.current) return;
      setEstado(r);
      setError(null);
    } catch (e) {
      if (!vivo.current || (e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (vivo.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    // La primera carga va en un microtask: el estado se fija en el callback del fetch, no en el cuerpo del efecto.
    queueMicrotask(() => void recargar());
    const id = window.setInterval(() => void recargar(), intervaloMs);
    return () => {
      vivo.current = false;
      window.clearInterval(id);
    };
  }, [intervaloMs, recargar]);

  return { estado, cargando, error, recargar };
}
