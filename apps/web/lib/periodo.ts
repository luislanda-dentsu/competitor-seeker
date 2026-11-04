// Periodo de análisis (puro: servidor y cliente). Viaja en la URL (?p=30d o
// ?p=custom&desde=…&hasta=…) y se recuerda en la cookie cs-periodo.
import type { Periodo } from "@competitor-seeker/core";
import { z } from "zod";

export const PERIODO_COOKIE = "cs-periodo";
export const CLAVES_PERIODO = ["7d", "30d", "90d", "todo", "custom"] as const;
export type ClavePeriodo = (typeof CLAVES_PERIODO)[number];
export const PERIODO_DEFECTO: ClavePeriodo = "30d";

export const ETIQUETA_PERIODO: Record<ClavePeriodo, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  todo: "Todo el histórico",
  custom: "Personalizado",
};

const DIAS: Partial<Record<ClavePeriodo, number>> = { "7d": 7, "30d": 30, "90d": 90 };
const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export interface PeriodoUi extends Periodo {
  clave: ClavePeriodo;
  etiqueta: string;
  /** Querystring canónico (sin "?") para enlaces que conservan el periodo. */
  query: string;
}

function restarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10);
}

function fmtCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

type Params = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Resuelve el periodo desde searchParams (o, si no traen `p`, desde el
 * querystring guardado en la cookie). Entradas inválidas → periodo por defecto.
 */
export function resolverPeriodo(params: Params, hoy: string, cookie?: string): PeriodoUi {
  let fuente: Params = params;
  if (!uno(params.p) && cookie) fuente = Object.fromEntries(new URLSearchParams(cookie));
  const p = uno(fuente.p);
  const clave: ClavePeriodo = (CLAVES_PERIODO as readonly string[]).includes(p ?? "") ? (p as ClavePeriodo) : PERIODO_DEFECTO;

  if (clave === "custom") {
    const desde = Fecha.safeParse(uno(fuente.desde));
    const hasta = Fecha.safeParse(uno(fuente.hasta));
    if (desde.success && hasta.success && desde.data <= hasta.data) {
      return {
        clave,
        desde: desde.data,
        hasta: hasta.data,
        etiqueta: `${fmtCorta(desde.data)} – ${fmtCorta(hasta.data)}`,
        query: new URLSearchParams({ p: clave, desde: desde.data, hasta: hasta.data }).toString(),
      };
    }
    return resolverPeriodo({ p: PERIODO_DEFECTO }, hoy);
  }
  if (clave === "todo") return { clave, desde: null, hasta: null, etiqueta: ETIQUETA_PERIODO.todo, query: "p=todo" };
  return { clave, desde: restarDias(hoy, DIAS[clave]! - 1), hasta: hoy, etiqueta: ETIQUETA_PERIODO[clave], query: `p=${clave}` };
}
