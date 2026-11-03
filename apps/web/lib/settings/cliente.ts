"use client";

// Utilidades cliente de Ajustes: llamada JSON con error legible y toasts.
import { toastManager } from "@/components/ui/toast";

export async function llamarApi<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const cuerpo = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(cuerpo.error ?? `Error ${res.status}`);
  return cuerpo;
}

export function avisarOk(title: string, description?: string): void {
  toastManager.add({ title, description, type: "success", timeout: 4000 });
}

export function avisarError(title: string, description?: string): void {
  toastManager.add({ title, description, type: "error", timeout: 7000 });
}
