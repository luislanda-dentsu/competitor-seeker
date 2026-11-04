// Solo servidor (Node): construye el contexto que el asistente recibe en el
// primer turno: marca.json, resumen de corridas, soul.md íntegro y las
// entradas del log serializadas de forma compacta (con tope).
import fs from "node:fs";
import path from "node:path";
import {
  leerLog,
  leerMarca,
  listarCorridas,
  repoRoot,
  type Corrida,
  type Entrada,
  type Marca,
} from "@competitor-seeker/core";

export const TOPE_ENTRADAS = 400;
export const TOPE_CARACTERES = 80_000;

export interface PiezasContexto {
  marca: Marca;
  corridas: readonly Corrida[];
  soul: string;
  entradas: readonly Entrada[];
  topeEntradas?: number;
  topeCaracteres?: number;
}

export interface Contexto {
  texto: string;
  /** Entradas incluidas / totales del log. */
  incluidas: number;
  total: number;
  ultimaCorrida: string | null;
}

/** Una línea por entrada: `id · competidor · fecha · señal · movimiento · lectura` (sin saltos). */
export function serializarEntrada(e: Entrada): string {
  const plano = (s: string) => s.replace(/\s+/g, " ").trim();
  return `${e.id} · ${plano(e.marca)} · ${e.fecha} · ${e.senal} · ${plano(e.movimiento)} · ${plano(e.lectura)}`;
}

/** Selecciona las entradas más recientes que caben en los topes y las devuelve en orden cronológico. */
export function seleccionarEntradas(
  entradas: readonly Entrada[],
  topeEntradas: number = TOPE_ENTRADAS,
  topeCaracteres: number = TOPE_CARACTERES,
): { lineas: string[]; incluidas: number } {
  // Más recientes primero (fecha desc; a igual fecha, las últimas del archivo).
  const indexadas = entradas.map((e, i) => ({ e, i }));
  indexadas.sort((a, b) => (a.e.fecha < b.e.fecha ? 1 : a.e.fecha > b.e.fecha ? -1 : b.i - a.i));
  const elegidas: { linea: string; i: number }[] = [];
  let chars = 0;
  for (const { e, i } of indexadas) {
    if (elegidas.length >= topeEntradas) break;
    const linea = serializarEntrada(e);
    if (chars + linea.length + 1 > topeCaracteres) break;
    chars += linea.length + 1;
    elegidas.push({ linea, i });
  }
  elegidas.sort((a, b) => a.i - b.i);
  return { lineas: elegidas.map((x) => x.linea), incluidas: elegidas.length };
}

export function serializarContexto(p: PiezasContexto): Contexto {
  const { marca, corridas, soul, entradas } = p;
  const { lineas, incluidas } = seleccionarEntradas(entradas, p.topeEntradas, p.topeCaracteres);
  const registradas = corridas.filter((c) => c.estado === "registrada");
  const ultimaCorrida = registradas.length ? registradas.map((c) => c.fecha).sort().at(-1)! : null;

  const competidores = marca.competidores.length
    ? marca.competidores.map((c) => `- ${c.nombre}${c.url ? ` · ${c.url}` : ""}${c.instagram ? ` · @${c.instagram}` : ""}${c.activo ? "" : " · INACTIVO"}`)
    : ["- (sin competidores)"];

  const corridasTxt = corridas.length
    ? corridas.map((c) => {
        const partes = [c.id, c.fecha, c.estado, `intentos ${c.intentos}`, c.verificado ? "verificada" : "no verificada", `${c.entradas.length} entradas`];
        if (c.objeciones.length) partes.push(`${c.objeciones.length} objeciones`);
        if (c.ig?.sesion && c.ig.sesion !== "ok") partes.push(`ig ${c.ig.sesion}`);
        if (c.error) partes.push(`error: ${c.error.replace(/\s+/g, " ").slice(0, 160)}`);
        return `- ${partes.join(" · ")}`;
      })
    : ["- (ninguna corrida)"];

  const texto = [
    `# Marca: ${marca.nombre} (${marca.slug})`,
    `Competidores vigilados (${marca.competidores.length}):`,
    ...competidores,
    "",
    `# Corridas (${corridas.length}; última registrada: ${ultimaCorrida ?? "ninguna"})`,
    "Formato: id · fecha · estado · intentos · verificación · entradas",
    ...corridasTxt,
    "",
    "# soul.md (criterio de análisis)",
    soul.trim() || "(vacío)",
    "",
    `# Entradas del log (${incluidas} de ${entradas.length}${incluidas < entradas.length ? ", las más recientes" : ""}; orden cronológico)`,
    "Formato: id · competidor · fecha · señal · movimiento · lectura",
    ...(lineas.length ? lineas : ["(el log está vacío: no hay hallazgos registrados)"]),
  ].join("\n");

  return { texto, incluidas, total: entradas.length, ultimaCorrida };
}

function leerSoul(): string {
  try {
    return fs.readFileSync(path.join(repoRoot(), "soul.md"), "utf8");
  } catch {
    return "";
  }
}

/** Lee marca.json, corridas, soul.md y el log de la marca y los serializa. Lanza si la marca no existe. */
export function construirContexto(slug: string): Contexto {
  const marca = leerMarca(slug);
  const { corridas } = listarCorridas(slug);
  const { items: entradas } = leerLog(slug);
  return serializarContexto({ marca, corridas, soul: leerSoul(), entradas });
}
