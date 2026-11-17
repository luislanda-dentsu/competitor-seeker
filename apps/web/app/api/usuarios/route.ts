import { cargarEnv, ErrorUsuarios, invitarUsuario, listarUsuarios, normalizarEmail, revocarUsuario, RolUsuario } from "@competitor-seeker/core";
import { connection } from "next/server";
import { z } from "zod";
import { errorJson, leerCuerpo, okJson } from "@/lib/settings/api";
import { exigirUsuario } from "@/lib/sesion";
import { sincronizarAjustes } from "@/lib/sync/ajustes";

const Invitacion = z.object({ email: z.string().trim().email("Correo inválido"), rol: RolUsuario });

function lista(): Response {
  const arranque = cargarEnv().CS_ADMIN_EMAIL;
  const e = arranque ? normalizarEmail(arranque) : null;
  return okJson({ usuarios: listarUsuarios().map((u) => ({ ...u, arranque: u.email === e })) });
}

/** GET /api/usuarios (admin) → lista de acceso; `arranque` marca a CS_ADMIN_EMAIL (no se edita aquí). */
export async function GET(): Promise<Response> {
  await connection();
  const usuario = await exigirUsuario({ admin: true });
  if (usuario instanceof Response) return usuario;
  try {
    return lista();
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}

/** POST /api/usuarios `{ email, rol }` (admin) → invita o cambia el rol. Se sincroniza por git. */
export async function POST(request: Request): Promise<Response> {
  const usuario = await exigirUsuario({ admin: true });
  if (usuario instanceof Response) return usuario;
  const { datos, respuesta } = await leerCuerpo(request, Invitacion);
  if (respuesta) return respuesta;
  if (normalizarEmail(datos.email) === usuario.email && datos.rol !== "admin") return errorJson("No puedes quitarte el rol de admin a ti misma", 400);
  try {
    invitarUsuario(datos.email, datos.rol, usuario.email);
  } catch (e) {
    return errorJson((e as Error).message, e instanceof ErrorUsuarios ? 400 : 500);
  }
  await sincronizarAjustes(`acceso: ${datos.rol} ${normalizarEmail(datos.email)}`);
  return lista();
}

/** DELETE /api/usuarios?email=… (admin) → quita el acceso. Efecto inmediato en esta Mac; en la otra, al sincronizar. */
export async function DELETE(request: Request): Promise<Response> {
  const usuario = await exigirUsuario({ admin: true });
  if (usuario instanceof Response) return usuario;
  const email = new URL(request.url).searchParams.get("email") ?? "";
  if (normalizarEmail(email) === usuario.email) return errorJson("No puedes quitarte el acceso a ti misma", 400);
  try {
    revocarUsuario(email);
  } catch (e) {
    return errorJson((e as Error).message, e instanceof ErrorUsuarios ? 400 : 500);
  }
  await sincronizarAjustes(`acceso: revocado ${normalizarEmail(email)}`);
  return lista();
}
