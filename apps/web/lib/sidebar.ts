"use client";

import { useCallback, useSyncExternalStore } from "react";

export const SIDEBAR_COOKIE = "cs-sidebar";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Estado del sidebar (expandido / colapsado).
 * La fuente de verdad visual es el atributo <html data-sidebar="collapsed">,
 * que ThemeScript fija desde la cookie antes del primer paint; aquí solo lo
 * leemos y escribimos, y persistimos la cookie para corridas futuras.
 */
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.sidebar === "collapsed";
}

function getServerSnapshot(): boolean {
  return false;
}

export function setSidebarCollapsed(collapsed: boolean): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (collapsed) html.dataset.sidebar = "collapsed";
  else delete html.dataset.sidebar;
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
  emit();
}

export function useSidebar(): {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
} {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const setCollapsed = useCallback((v: boolean) => setSidebarCollapsed(v), []);
  const toggle = useCallback(() => setSidebarCollapsed(!getSnapshot()), []);
  return { collapsed, setCollapsed, toggle };
}
