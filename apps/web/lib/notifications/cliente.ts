"use client";

// Cliente de `/api/notificaciones`: fetch, marcar leídas y memoria de sesión
// de las ya mostradas como toast (sessionStorage, tolerante a fallos).
import type { Notificacion } from "@competitor-seeker/core/notificaciones";

export type { Notificacion };

export const INTERVALO_NOTIFICACIONES_MS = 30 * 1000;
const CLAVE_VISTAS = "cs-notificaciones-vistas";
const MAX_VISTAS = 200;

export interface RespuestaNotificaciones {
  notificaciones: Notificacion[];
  noLeidas: number;
}

export async function fetchNotificaciones(o: { noLeidas?: boolean; limite?: number } = {}, signal?: AbortSignal): Promise<RespuestaNotificaciones> {
  const params = new URLSearchParams();
  if (o.noLeidas) params.set("noLeidas", "1");
  if (o.limite) params.set("limite", String(o.limite));
  const qs = params.toString();
  const res = await fetch(`/api/notificaciones${qs ? `?${qs}` : ""}`, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json()) as RespuestaNotificaciones;
}

export async function marcarLeidaEnApi(id: string): Promise<void> {
  const res = await fetch(`/api/notificaciones/${encodeURIComponent(id)}/leida`, { method: "POST" });
  if (!res.ok && res.status !== 404) throw new Error(`Error ${res.status}`);
}

export async function marcarTodasLeidasEnApi(): Promise<void> {
  const res = await fetch("/api/notificaciones/leidas", { method: "POST" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

export function leerVistas(): Set<string> {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_VISTAS);
    if (!crudo) return new Set();
    const lista = JSON.parse(crudo) as unknown;
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function guardarVistas(vistas: Set<string>): void {
  try {
    window.sessionStorage.setItem(CLAVE_VISTAS, JSON.stringify([...vistas].slice(-MAX_VISTAS)));
  } catch {
    /* sessionStorage bloqueado: solo perdemos la memoria entre recargas */
  }
}

/** Agrupa en "Hoy" / "Antes" según la fecha local del `ts`. */
export function agruparPorDia(lista: readonly Notificacion[], ahora: Date = new Date()): { hoy: Notificacion[]; antes: Notificacion[] } {
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  const hoy: Notificacion[] = [];
  const antes: Notificacion[] = [];
  for (const n of lista) {
    const t = Date.parse(n.ts);
    (Number.isFinite(t) && t >= inicioHoy ? hoy : antes).push(n);
  }
  return { hoy, antes };
}

/** '14:05' si es de hoy; '12 ago' si no. */
export function horaCorta(iso: string, ahora: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const mismoDia = d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth() && d.getDate() === ahora.getDate();
  if (mismoDia) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}
