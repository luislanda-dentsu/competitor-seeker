// Marca activa (solo servidor). La server action que la cambia vive en
// lib/brand-actions.ts (un archivo "use server" solo exporta funciones async).
import { listarMarcas, type Marca, type Senal } from "@competitor-seeker/core";
import { cookies } from "next/headers";
import { cache } from "react";
import { MARCA_COOKIE } from "@/lib/brand-cookie";
import { cargarDatosMarca } from "@/lib/data/marca";
import { resolverMarcaActiva } from "@/lib/data/slugs";

export { MARCA_COOKIE };

export interface MarcaOpcion {
  slug: string;
  nombre: string;
}

export interface CompetidorNav {
  slug: string;
  nombre: string;
  senal: Senal | null;
}

/** Lo que el shell (BrandSwitcher, sidebar) necesita saber de la marca activa. */
export interface ContextoMarca {
  marcas: MarcaOpcion[];
  activa: string | null;
  competidores: CompetidorNav[];
}

const listarMarcasCached = cache((): Marca[] => listarMarcas());

/**
 * Slug de la marca activa: cookie `cs-marca` si existe y es válida; si no,
 * la primera de `listarMarcas()`; si no hay marcas, null.
 * Lee `cookies()` SIEMPRE antes de decidir (también cuando no hay marcas):
 * es dato de runtime y así el resultado nunca se hornea en el shell
 * estático. Llamar solo dentro de un Suspense.
 */
export async function getMarcaActiva(): Promise<string | null> {
  const jar = await cookies();
  if (listarMarcasCached().length === 0) return null;
  return resolverMarcaActiva(jar.get(MARCA_COOKIE)?.value);
}

/** Marcas disponibles como opciones del selector. */
export function listarOpcionesMarca(): MarcaOpcion[] {
  return listarMarcasCached().map((m) => ({ slug: m.slug, nombre: m.nombre }));
}

/**
 * Contexto que el AppShell pasa (como promesa) al BrandProvider. Los
 * consumidores lo leen con `use()` dentro de su propio Suspense.
 */
export async function cargarContextoMarca(): Promise<ContextoMarca> {
  const activa = await getMarcaActiva();
  const marcas = listarOpcionesMarca();
  if (!activa) return { marcas, activa: null, competidores: [] };
  let competidores: CompetidorNav[] = [];
  try {
    competidores = cargarDatosMarca(activa).competidores
      .filter((c) => c.activo)
      .map((c) => ({ slug: c.slug, nombre: c.nombre, senal: c.senal }));
  } catch {
    // marca.json roto: el shell sigue funcionando; la página mostrará el error.
    competidores = [];
  }
  return { marcas, activa, competidores };
}
