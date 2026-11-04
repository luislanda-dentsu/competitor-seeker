// Solo servidor: HTML estático autocontenido de una marca (panel de la plantilla legacy).
import fs from "node:fs";
import path from "node:path";
import { repoRoot, type Entrada } from "@competitor-seeker/core";

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
    .replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}

/** Sustituye el bloque DATOS de la plantilla por `corrida` + `entradas` (sin id/corrida internos). */
export function generarHtmlExport(plantilla: string, corrida: string, entradas: readonly Entrada[]): string {
  const i = plantilla.indexOf(INICIO);
  const f = plantilla.indexOf(FIN);
  if (i === -1 || f === -1 || f < i) throw new Error("La plantilla no tiene el bloque INICIO DATOS / FIN DATOS");
  const datos = {
    corrida,
    entradas: entradas.map((e) => ({ marca: e.marca, fecha: e.fecha, movimiento: e.movimiento, senal: e.senal, lectura: e.lectura })),
  };
  const bloque = `${INICIO} · generado por la exportación -->\n<script type="application/json" id="datos">\n${jsonParaScript(datos)}\n</script>\n`;
  return plantilla.slice(0, i) + bloque + plantilla.slice(f);
}

export function leerPlantillaExport(): string {
  return fs.readFileSync(rutaPlantillaExport(), "utf8");
}
