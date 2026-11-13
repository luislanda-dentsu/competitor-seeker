import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/sesion";
import { connection } from "next/server";
import { competidoresActivos, crearMarca, listarMarcas, slugify, ultimaCorridaRegistrada } from "@competitor-seeker/core";
import { sincronizarAjustes } from "@/lib/sync/ajustes";
import { errorJson, leerCuerpo, okJson } from "@/lib/settings/api";
import type { MarcaAjustes } from "@/lib/settings/tipos";
import { CuerpoNuevaMarca } from "@/lib/settings/validacion";

function resumen(slug: string): MarcaAjustes[] {
  return listarMarcas()
    .filter((m) => slug === "" || m.slug === slug)
    .map((m) => ({
      slug: m.slug,
      nombre: m.nombre,
      creadaEn: m.creadaEn,
      competidores: competidoresActivos(m).length,
      ultimaCorrida: ultimaCorridaRegistrada(m.slug),
    }));
}

/** GET /api/marcas → `{ marcas }`. */
export async function GET(): Promise<Response> {
  await connection();
  return okJson({ marcas: resumen("") });
}

/** POST /api/marcas `{ nombre }` → crea `marcas/<slug>/` (201) · 409 si ya existe o está archivada. */
export async function POST(request: Request): Promise<Response> {
  const usuario = await exigirUsuario();
  if (usuario instanceof Response) return usuario;
  const { datos, respuesta } = await leerCuerpo(request, CuerpoNuevaMarca);
  if (respuesta) return respuesta;
  if (!slugify(datos.nombre)) return errorJson(`No se pudo derivar un slug de "${datos.nombre}"`, 400);
  try {
    const marca = crearMarca({ nombre: datos.nombre });
    await sincronizarAjustes(`ajustes: alta de marca ${marca.slug}`);
    revalidatePath("/", "layout");
    return okJson({ marca: resumen(marca.slug)[0] }, 201);
  } catch (e) {
    const msg = (e as Error).message;
    return errorJson(msg, /ya existe|archivada/.test(msg) ? 409 : 500);
  }
}
