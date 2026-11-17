"use server";

import { signOut } from "@/lib/auth";

/** Cierra la sesión y vuelve a la pantalla de entrada. */
export async function salir(): Promise<void> {
  await signOut({ redirectTo: "/entrar" });
}
