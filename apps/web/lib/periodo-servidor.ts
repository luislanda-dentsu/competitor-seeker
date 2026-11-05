// Solo servidor: periodo de la request (searchParams → cookie → defecto).
import { fechaLocal } from "@competitor-seeker/core";
import { cookies } from "next/headers";
import { PERIODO_COOKIE, resolverPeriodo, type PeriodoUi } from "./periodo";

export async function periodoDeRequest(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<PeriodoUi> {
  const [params, jar] = await Promise.all([searchParams, cookies()]);
  return resolverPeriodo(params, fechaLocal(new Date()), jar.get(PERIODO_COOKIE)?.value);
}
