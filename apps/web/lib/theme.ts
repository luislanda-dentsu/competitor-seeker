"use client";

import { useCallback, useSyncExternalStore } from "react";

export const THEME_KEY = "cs-theme";

export type ThemePref = "light" | "dark" | "system";
export type ThemeResolved = "light" | "dark";

export const THEME_PREFS: readonly ThemePref[] = ["light", "dark", "system"];

export function isThemePref(v: unknown): v is ThemePref {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * Script inline (string) que se ejecuta antes del primer paint.
 * Debe ser autocontenido: no importa nada de este módulo.
 * - lee localStorage['cs-theme'] (light|dark|system; default dark, como Orbit)
 * - resuelve system con matchMedia
 * - fija <html data-theme="light|dark">
 * - lee la cookie cs-sidebar y fija <html data-sidebar="collapsed"> si aplica
 * - fija <html data-section> según la ruta (mismo criterio que lib/section.ts) para que el acento no parpadee
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k="cs-theme";var p=null;try{p=localStorage.getItem(k)}catch(e){}if(p!=="light"&&p!=="dark"&&p!=="system"){p="dark"}var d=p==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;var h=document.documentElement;h.dataset.theme=d;h.dataset.themePref=p;var m=document.cookie.match(/(?:^|; )cs-sidebar=([^;]*)/);if(m&&decodeURIComponent(m[1])==="collapsed"){h.dataset.sidebar="collapsed"}var u=location.pathname;h.dataset.section=u.indexOf("/competidores")===0?"competidores":u.indexOf("/corridas")===0?"corridas":u.indexOf("/asistente")===0?"asistente":"general"}catch(e){}})();`;

function readPref(): ThemePref {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return isThemePref(v) ? v : "dark";
  } catch {
    return "dark";
  }
}

function systemTheme(): ThemeResolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(pref: ThemePref): ThemeResolved {
  return pref === "system" ? systemTheme() : pref;
}

/** Aplica la preferencia al documento y la persiste. */
export function applyTheme(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(pref);
  const html = document.documentElement;
  html.dataset.theme = resolved;
  html.dataset.themePref = pref;
  try {
    window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* almacenamiento bloqueado: el tema vive solo en memoria */
  }
}

/* ---- store mínimo para useSyncExternalStore ---- */
const listeners = new Set<() => void>();
let mediaBound = false;

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!mediaBound && typeof window !== "undefined") {
    mediaBound = true;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => {
      if (readPref() === "system") applyTheme("system");
      emit();
    });
    window.addEventListener("storage", (e) => {
      if (e.key === THEME_KEY) {
        applyTheme(readPref());
        emit();
      }
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemePref {
  return readPref();
}

function getServerSnapshot(): ThemePref {
  return "dark";
}

export function useTheme(): {
  pref: ThemePref;
  resolved: ThemeResolved;
  setTheme: (pref: ThemePref) => void;
} {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setTheme = useCallback((next: ThemePref) => {
    applyTheme(next);
    emit();
  }, []);
  return { pref, resolved: resolveTheme(pref), setTheme };
}
