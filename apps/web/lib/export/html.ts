// Solo servidor: HTML estático autocontenido de una marca (panel de la plantilla legacy).
import fs from "node:fs";
import path from "node:path";
import { repoRoot, type Entrada, type FormatoPost, type MetricasCompetidor } from "@competitor-seeker/core";

const INICIO = "<!-- INICIO DATOS";
const FIN = "<!-- FIN DATOS -->";

/** Ruta de la plantilla del panel estático. */
export function rutaPlantillaExport(): string {
  return path.join(repoRoot(), "docs", "legacy", "plantilla.html");
}

/** JSON apto para incrustar en `<script>`: escapa `</` y los separadores de línea Unicode. */
export function jsonParaScript(valor: unknown): string {
  return JSON.stringify(valor, null, 2)
    .replace(/<\//g, "<\\/")
    .replace(/<!--/g, "\\u003c!--") // `<!--` dentro de <script> alteraría el cierre del bloque
    .replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}

/** Rendimiento de un competidor tal como lo pinta el panel estático (solo cifras de Apify). */
export interface RendimientoExport {
  competidor: string;
  cobertura: MetricasCompetidor["cobertura"];
  posts: number;
  conCifras: number;
  cadenciaSemanal: number | null;
  erPromedio: number | null;
  likesPromedio: number | null;
  comentariosPromedio: number | null;
  vistasMediana: number | null;
  seguidores: number | null;
  deltaSeguidores: number | null;
  formatos: Partial<Record<FormatoPost, number>>;
  top: { url: string; fecha: string; formato: FormatoPost; er: number | null }[];
}

/** Proyección de `MetricasCompetidor` a lo que el panel estático necesita (sin series ni lecturas). */
export function rendimientoExport(m: MetricasCompetidor): RendimientoExport {
  return {
    competidor: m.competidor,
    cobertura: m.cobertura,
    posts: m.posts,
    conCifras: m.conCifras,
    cadenciaSemanal: m.cadenciaSemanal,
    erPromedio: m.er.promedio,
    likesPromedio: m.likes.promedio,
    comentariosPromedio: m.comentarios.promedio,
    vistasMediana: m.vistas.mediana,
    seguidores: m.seguidores.actual,
    deltaSeguidores: m.seguidores.delta,
    formatos: m.formatos,
    top: m.top.slice(0, 3).map((p) => ({ url: p.url, fecha: p.fecha, formato: p.formato, er: p.er })),
  };
}

/** Sustituye el bloque DATOS de la plantilla por `corrida` + `entradas` (sin id/corrida internos) + `rendimiento`. */
export function generarHtmlExport(
  plantilla: string,
  corrida: string,
  entradas: readonly Entrada[],
  rendimiento: readonly RendimientoExport[] = [],
): string {
  const i = plantilla.indexOf(INICIO);
  const f = plantilla.indexOf(FIN);
  if (i === -1 || f === -1 || f < i) throw new Error("La plantilla no tiene el bloque INICIO DATOS / FIN DATOS");
  const datos = {
    corrida,
    entradas: entradas.map((e) => ({ marca: e.marca, fecha: e.fecha, movimiento: e.movimiento, senal: e.senal, lectura: e.lectura })),
    rendimiento,
  };
  const bloque = `${INICIO} · generado por la exportación -->\n<script type="application/json" id="datos">\n${jsonParaScript(datos)}\n</script>\n`;
  return plantilla.slice(0, i) + bloque + plantilla.slice(f);
}

export function leerPlantillaExport(): string {
  return fs.readFileSync(rutaPlantillaExport(), "utf8");
}
