import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { existeMarca, guardarMarca, handleInstagram, leerMarca, slugify, type Competidor } from "@competitor-seeker/core";
import { sincronizarAjustes } from "@/lib/sync/ajustes";
import { errorJson, leerCuerpo, okJson } from "@/lib/settings/api";
import type { CompetidorAjustes } from "@/lib/settings/tipos";
import { CuerpoCompetidores, SLUG_RE } from "@/lib/settings/validacion";

type Ctx = { params: Promise<{ slug: string }> };

function aUi(c: Competidor): CompetidorAjustes {
  return { slug: c.slug, nombre: c.nombre, url: c.url ?? "", ...(c.instagram ? { instagram: c.instagram } : {}), activo: c.activo };
}

/** GET /api/marcas/[slug]/competidores → `{ competidores }` (todos, activos o no). */
export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  await connection();
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return errorJson("Slug inválido", 400);
  if (!existeMarca(slug)) return errorJson(`La marca "${slug}" no existe`, 404);
  try {
    return okJson({ competidores: leerMarca(slug).competidores.map(aUi) });
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}

/**
 * PUT /api/marcas/[slug]/competidores `{ competidores: [{ nombre, url, activo }] }`
 * → reemplaza la lista de vigilancia en `marca.json` (slug e instagram se derivan).
 * El log histórico no se toca: quitar un competidor solo lo saca de la lista.
 */
export async function PUT(request: Request, { params }: Ctx): Promise<Response> {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return errorJson("Slug inválido", 400);
  if (!existeMarca(slug)) return errorJson(`La marca "${slug}" no existe`, 404);
  const { datos, respuesta } = await leerCuerpo(request, CuerpoCompetidores);
  if (respuesta) return respuesta;
  try {
    const marca = leerMarca(slug);
    const competidores: Competidor[] = datos.competidores.map((c) => {
      const url = c.url.trim();
      const instagram = handleInstagram(url || undefined);
      return {
        slug: slugify(c.nombre),
        nombre: c.nombre.trim(),
        ...(url ? { url } : {}),
        ...(instagram ? { instagram } : {}),
        activo: c.activo,
      };
    });
    const guardada = guardarMarca({ ...marca, competidores });
    await sincronizarAjustes(`ajustes: competidores de ${slug}`);
    revalidatePath("/", "layout");
    return okJson({ competidores: guardada.competidores.map(aUi) });
  } catch (e) {
    return errorJson(`No se pudo guardar marca.json: ${(e as Error).message}`, 500);
  }
}
