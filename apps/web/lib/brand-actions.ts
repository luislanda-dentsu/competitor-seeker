"use server";

import { listarMarcas } from "@competitor-seeker/core";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { MARCA_COOKIE, MARCA_COOKIE_MAX_AGE } from "@/lib/brand-cookie";

// Un archivo "use server" solo puede exportar funciones async: la constante
// de la cookie vive en lib/brand-cookie.ts y el lector en lib/brand.ts.

/**
 * Fija la marca activa en la cookie `cs-marca` (path=/, 1 año) y revalida
 * todo el árbol para que shell y páginas se rendericen con la nueva marca.
 * Un slug desconocido se ignora (no se escribe nada).
 */
export async function setMarcaActiva(slug: string): Promise<void> {
  if (typeof slug !== "string" || !listarMarcas().some((m) => m.slug === slug)) {
    return;
  }
  const jar = await cookies();
  jar.set(MARCA_COOKIE, slug, {
    path: "/",
    maxAge: MARCA_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
}
