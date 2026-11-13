import { connection } from "next/server";
import { exigirUsuario } from "@/lib/sesion";
import { guardarSecrets, invalidarCacheUso, leerSecretsArchivo } from "@competitor-seeker/core";
import { errorJson, leerCuerpo, okJson } from "@/lib/settings/api";
import { estadoToken } from "@/lib/settings/datos";
import { CuerpoToken } from "@/lib/settings/validacion";

/** GET /api/ajustes/apify → `{ configurado, ultimos4? }`. Nunca devuelve el token. */
export async function GET(): Promise<Response> {
  await connection();
  return okJson(estadoToken());
}

/** PUT /api/ajustes/apify `{ token }` → guarda en data/secrets.json (0600) e invalida la caché de uso. */
export async function PUT(request: Request): Promise<Response> {
  const usuario = await exigirUsuario({ admin: true });
  if (usuario instanceof Response) return usuario;
  const { datos, respuesta } = await leerCuerpo(request, CuerpoToken);
  if (respuesta) return respuesta;
  try {
    guardarSecrets({ ...leerSecretsArchivo(), apifyToken: datos.token });
    invalidarCacheUso();
  } catch (e) {
    return errorJson(`No se pudo guardar el token: ${(e as Error).message}`, 500);
  }
  return okJson(estadoToken());
}

/** DELETE /api/ajustes/apify → quita el token del archivo (no toca `APIFY_TOKEN` del entorno). */
export async function DELETE(): Promise<Response> {
  const usuario = await exigirUsuario({ admin: true });
  if (usuario instanceof Response) return usuario;
  try {
    const resto = { ...leerSecretsArchivo() };
    delete resto.apifyToken;
    guardarSecrets(resto);
    invalidarCacheUso();
  } catch (e) {
    return errorJson(`No se pudo quitar el token: ${(e as Error).message}`, 500);
  }
  return okJson(estadoToken());
}
