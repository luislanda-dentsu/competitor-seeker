import { connection } from "next/server";
import { exigirUsuario } from "@/lib/sesion";
import { competidoresActivos, existeMarca, fechaLocal, leerLog, leerMarca, listarCorridas, metricasMarca, ultimaCorridaRegistrada } from "@competitor-seeker/core";
import { generarHtmlExport, leerPlantillaExport, rendimientoExport } from "@/lib/export/html";
import { errorJson } from "@/lib/settings/api";
import { SLUG_RE } from "@/lib/settings/validacion";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/marcas/[slug]/export → panel HTML estático autocontenido con el log de la marca. */
export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const usuario = await exigirUsuario();
  if (usuario instanceof Response) return usuario;
  await connection();
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return errorJson("Slug inválido", 400);
  if (!existeMarca(slug)) return errorJson(`La marca "${slug}" no existe`, 404);
  try {
    const entradas = leerLog(slug).items;
    const corrida = ultimaCorridaRegistrada(slug) ?? entradas.reduce((m, e) => (e.fecha > m ? e.fecha : m), "");
    const fecha = corrida || fechaLocal();
    // Rendimiento de todo el histórico: competidores activos + los que aparecen en el log.
    const nombres = [...new Set([...competidoresActivos(leerMarca(slug)).map((c) => c.nombre), ...entradas.map((e) => e.marca)])];
    const rendimiento = metricasMarca(listarCorridas(slug).corridas, nombres, { hoy: fechaLocal() }).map(rendimientoExport);
    const html = generarHtmlExport(leerPlantillaExport(), fecha, entradas, rendimiento);
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
