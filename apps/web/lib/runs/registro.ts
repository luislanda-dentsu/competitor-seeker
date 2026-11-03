// Solo servidor (Node): nunca importar desde componentes cliente.

import type { ChildProcess } from "node:child_process";

/** Corrida viva en este proceso de Next. */
export interface CorridaViva {
  corridaId: string;
  marca: string;
  inicio: string;
  controller: AbortController;
  proceso: ChildProcess | null;
  cancelada: boolean;
  /** Se resuelve cuando el runner cerró la corrida y liberó el lock. */
  terminada: Promise<void>;
}

type Registro = Map<string, CorridaViva>;

/**
 * Next (dev) recarga los módulos al tocar archivos: el registro vive en
 * `globalThis` para no perder la referencia al proceso y poder cancelarlo.
 */
function registro(): Registro {
  const g = globalThis as typeof globalThis & { __csCorridasVivas?: Registro };
  g.__csCorridasVivas ??= new Map();
  return g.__csCorridasVivas;
}

export function registrarViva(viva: CorridaViva): void {
  registro().set(viva.corridaId, viva);
}

export function quitarViva(corridaId: string): void {
  registro().delete(corridaId);
}

export function obtenerViva(corridaId: string): CorridaViva | undefined {
  return registro().get(corridaId);
}

export function vivas(): CorridaViva[] {
  return [...registro().values()];
}
