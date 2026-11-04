"use client";

import { useCallback, useEffect, useState } from "react";

export interface EstadoSyncUi {
  remoto: boolean;
  rama: string;
  adelante: number;
  atras: number;
  sucio: string[];
  ultimoPull?: string;
  ultimoPush?: string;
  conflicto?: string[];
  error?: string;
}

export const INTERVALO_SYNC_MS = 60_000;

export type NivelSync = "ok" | "pendiente" | "error" | "sin-remoto";

export function nivelSync(e: EstadoSyncUi | null): NivelSync {
  if (!e || !e.remoto) return "sin-remoto";
  if ((e.conflicto && e.conflicto.length > 0) || e.error) return "error";
  if (e.adelante > 0 || e.atras > 0 || e.sucio.length > 0) return "pendiente";
  return "ok";
}

export function detalleSync(e: EstadoSyncUi | null): string {
  if (!e) return "Cargando estado de git…";
  if (!e.remoto) return "Sin remoto configurado: los datos solo viven en esta Mac.";
  if (e.conflicto && e.conflicto.length > 0) return `Conflicto en ${e.conflicto.join(", ")}`;
  if (e.error) return `Error de git: ${e.error}`;
  const partes: string[] = [];
  if (e.adelante > 0) partes.push(`${e.adelante} sin subir`);
  if (e.atras > 0) partes.push(`${e.atras} por bajar`);
  if (e.sucio.length > 0) partes.push(`${e.sucio.length} con cambios locales`);
  return partes.length > 0 ? partes.join(" · ") : `Al día con ${e.rama}`;
}

export function horaSync(iso: string | undefined): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "nunca" : d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

/** Estado de sync con polling cada 60 s y `sincronizar()` manual (pull + push). */
export function useEstadoSync(): {
  estado: EstadoSyncUi | null;
  sincronizando: boolean;
  sincronizar: () => Promise<void>;
} {
  const [estado, setEstado] = useState<EstadoSyncUi | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/sync", { cache: "no-store" });
      if (r.ok) setEstado((await r.json()) as EstadoSyncUi);
    } catch {
      /* se reintenta en el siguiente ciclo */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void cargar());
    const t = setInterval(() => void cargar(), INTERVALO_SYNC_MS);
    return () => clearInterval(t);
  }, [cargar]);

  const sincronizar = useCallback(async () => {
    setSincronizando(true);
    try {
      for (const accion of ["pull", "push"] as const) {
        const r = await fetch("/api/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accion }),
        });
        const cuerpo = (await r.json().catch(() => null)) as { resultado?: { ok: boolean }; estado?: EstadoSyncUi } | null;
        if (cuerpo?.estado) setEstado(cuerpo.estado);
        if (!r.ok || cuerpo?.resultado?.ok === false) break;
      }
    } finally {
      setSincronizando(false);
      await cargar();
    }
  }, [cargar]);

  return { estado, sincronizando, sincronizar };
}
