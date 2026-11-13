import { connection } from "next/server";
import { exigirUsuario } from "@/lib/sesion";
import { ConfigCompartida, guardarConfig, leerConfig } from "@competitor-seeker/core";
import { sincronizarAjustes } from "@/lib/sync/ajustes";
import { fusionarConfig } from "@/lib/settings/fusion";
import { errorJson, leerCuerpo, okJson } from "@/lib/settings/api";

/** GET /api/ajustes/config → `config.json` validado (con defaults). */
export async function GET(): Promise<Response> {
  const usuario = await exigirUsuario();
  if (usuario instanceof Response) return usuario;
  await connection();
  try {
    return okJson(leerConfig());
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}

/**
 * PUT /api/ajustes/config → acepta `ConfigCompartida` completa o solo `{ apify }`;
 * lo que falte se conserva de la config actual. Valida con el schema del core.
 */
export async function PUT(request: Request): Promise<Response> {
  const usuario = await exigirUsuario({ admin: true });
  if (usuario instanceof Response) return usuario;
  const { datos, respuesta } = await leerCuerpo(request, ConfigCompartida.partial());
  if (respuesta) return respuesta;
  try {
    const actual = leerConfig();
    const nueva = ConfigCompartida.parse(fusionarConfig(actual, datos));
    const guardada = guardarConfig(nueva);
    await sincronizarAjustes("ajustes: config.json");
    return okJson(guardada);
  } catch (e) {
    return errorJson(`No se pudo guardar config.json: ${(e as Error).message}`, 500);
  }
}
