// Solo servidor: usuario de la petición para route handlers y páginas (defensa en profundidad:
// el proxy ya filtró, pero cada handler que muta vuelve a comprobarlo).
import { buscarUsuario, cargarEnv, type Usuario } from "@competitor-seeker/core";
import { NextResponse } from "next/server";
import { modoAcceso } from "@/lib/acceso";
import { auth } from "@/lib/auth";

export interface UsuarioSesion extends Pick<Usuario, "email" | "rol"> {
  nombre: string | null;
  imagen: string | null;
}

/** Usuario actual o null. En modo abierto local (CS_AUTH=off) es un admin «local». */
export async function usuarioActual(): Promise<UsuarioSesion | null> {
  const modo = modoAcceso(cargarEnv());
  if (modo === "abierto-local") return { email: "local", rol: "admin", nombre: "Modo local", imagen: null };
  if (modo !== "google") return null;
  const sesion = await auth();
  const u = buscarUsuario(sesion?.user?.email);
  if (!u) return null;
  return { email: u.email, rol: u.rol, nombre: sesion?.user?.name ?? null, imagen: sesion?.user?.image ?? null };
}

/** Para route handlers: el usuario, o la Response 401/403 que hay que devolver. */
export async function exigirUsuario(o: { admin?: boolean } = {}): Promise<UsuarioSesion | Response> {
  const u = await usuarioActual();
  if (!u) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  if (o.admin && u.rol !== "admin") return NextResponse.json({ error: "Solo un admin puede hacer esto" }, { status: 403 });
  return u;
}
