import { connection } from "next/server";
import { existeMarca, fechaLocal, leerLog, ultimaCorridaRegistrada } from "@competitor-seeker/core";
import { generarHtmlExport, leerPlantillaExport } from "@/lib/export/html";
import { errorJson } from "@/lib/settings/api";
import { SLUG_RE } from "@/lib/settings/validacion";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/marcas/[slug]/export → panel HTML estático autocontenido con el log de la marca. */
export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  await connection();
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return errorJson("Slug inválido", 400);
  if (!existeMarca(slug)) return errorJson(`La marca "${slug}" no existe`, 404);
  try {
    const entradas = leerLog(slug).items;
    const corrida = ultimaCorridaRegistrada(slug) ?? entradas.reduce((m, e) => (e.fecha > m ? e.fecha : m), "");
    const fecha = corrida || fechaLocal();
    const html = generarHtmlExport(leerPlantillaExport(), fecha, entradas);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-${fecha}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}
