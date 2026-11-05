// Solo servidor: periodo de la request (searchParams → cookie → defecto).
import { fechaLocal } from "@competitor-seeker/core";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { PERIODO_COOKIE, resolverPeriodo, type PeriodoUi } from "./periodo";

export async function periodoDeRequest(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<PeriodoUi> {
  // «Hoy» es dato de request: connection() lo marca dinámico antes de leer la hora (Cache Components).
  const [params, jar] = await Promise.all([searchParams, cookies(), connection()]);
  return resolverPeriodo(params, fechaLocal(new Date()), jar.get(PERIODO_COOKIE)?.value);
}
