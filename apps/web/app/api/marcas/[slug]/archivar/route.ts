import { revalidatePath } from "next/cache";
import { archivarMarca, esLockHuerfano, existeMarca, leerLock, leerMarca, listarCorridas } from "@competitor-seeker/core";
import { reconciliarHuerfanas } from "@/lib/runs/runner";
import { sincronizarAjustes } from "@/lib/sync/ajustes";
import { errorJson, leerCuerpo, okJson } from "@/lib/settings/api";
import { CuerpoArchivarMarca, SLUG_RE } from "@/lib/settings/validacion";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST /api/marcas/[slug]/archivar `{ nombre }` → mueve la carpeta a
 * `marcas/_archivo/<slug>`. Nunca borra. Exige el nombre exacto como confirmación.
 */
export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return errorJson("Slug inválido", 400);
  if (!existeMarca(slug)) return errorJson(`La marca "${slug}" no existe`, 404);
  if (corridaActiva(slug)) {
    return errorJson(`La marca "${slug}" tiene una corrida en curso; espera a que termine para archivarla.`, 409);
  }
  const { datos, respuesta } = await leerCuerpo(request, CuerpoArchivarMarca);
  if (respuesta) return respuesta;
  let nombre: string;
  try {
    nombre = leerMarca(slug).nombre;
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
  if (datos.nombre.trim().toLowerCase() !== nombre.trim().toLowerCase()) {
    return errorJson(`El nombre no coincide: escribe "${nombre}" para archivar.`, 422);
  }
  // Segunda comprobación justo antes de mover: una corrida pudo arrancar mientras se leía el cuerpo.
  if (corridaActiva(slug)) {
    return errorJson(`La marca "${slug}" tiene una corrida en curso; espera a que termine para archivarla.`, 409);
  }
  try {
    const destino = archivarMarca(slug);
    await sincronizarAjustes(`ajustes: archivar marca ${slug}`);
    revalidatePath("/", "layout");
    return okJson({ ok: true, slug, destino });
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}

/** Hay corrida viva: lock vigente de esa marca, o corrida `en-curso` que sobrevive a la reconciliación de huérfanas. */
function corridaActiva(slug: string): boolean {
  try {
    reconciliarHuerfanas(); // las `en-curso` sin proceso ni lock vivo pasan a error
  } catch {
    /* la reconciliación es best-effort */
  }
  const lock = leerLock();
  if (lock && lock.marca === slug && !esLockHuerfano(lock)) return true;
  return listarCorridas(slug).corridas.some((c) => c.estado === "en-curso");
}
