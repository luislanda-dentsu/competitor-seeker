// Solo servidor (Node): nunca importar desde componentes cliente.

import fs from "node:fs";
import { cookies } from "next/headers";
import {
  existeCorrida,
  leerCorrida,
  listarMarcas,
  parsearLineasStream,
  resumirEventos,
  type Corrida,
  type EventoCorrida,
  type Marca,
} from "@competitor-seeker/core";
import { rutaStream } from "@/lib/runs/rutas";

export const COOKIE_MARCA = "cs-marca";

/** Marca activa: cookie `cs-marca` o la primera de `listarMarcas()`. */
export async function marcaActiva(marcas: readonly Marca[] = listarMarcas()): Promise<Marca | null> {
  const jar = await cookies();
  const slug = jar.get(COOKIE_MARCA)?.value;
  return marcas.find((m) => m.slug === slug) ?? marcas[0] ?? null;
}

/** Busca la corrida por id en todas las marcas (primero en `preferida`). */
export function buscarCorrida(id: string, preferida?: string | null): Corrida | null {
  const slugs = listarMarcas().map((m) => m.slug);
  const orden = preferida && slugs.includes(preferida) ? [preferida, ...slugs.filter((s) => s !== preferida)] : slugs;
  for (const slug of orden) {
    if (!existeCorrida(slug, id)) continue;
    try {
      return leerCorrida(slug, id);
    } catch {
      return null;
    }
  }
  return null;
}

/** Eventos resumidos de la consola grabada, o null si no hay stream. */
export function eventosGrabados(id: string, maxLineas: number = 5000): EventoCorrida[] | null {
  const ruta = rutaStream(id);
  if (!fs.existsSync(ruta)) return null;
  const texto = fs.readFileSync(ruta, "utf8");
  const { eventos } = parsearLineasStream(texto.endsWith("\n") ? texto : `${texto}\n`);
  const salida: EventoCorrida[] = [];
  for (const ev of eventos) {
    if (ev.type === "cs_error" || ev.type === "cs_stderr") {
      salida.push({ ts: 0, tipo: "info", etiqueta: ev.type === "cs_error" ? "error" : "stderr", texto: String(ev.texto ?? "") });
      continue;
    }
    salida.push(...resumirEventos(ev, 0));
    if (salida.length >= maxLineas) break;
  }
  return salida;
}
