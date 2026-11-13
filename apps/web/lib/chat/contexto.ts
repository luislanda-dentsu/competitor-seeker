// Solo servidor (Node): construye el contexto que el asistente recibe en el
// primer turno: marca.json, resumen de corridas, soul.md íntegro y las
// entradas del log serializadas de forma compacta (con tope).
import fs from "node:fs";
import path from "node:path";
import {
  fechaLocal,
  leerLog,
  leerMarca,
  listarCorridas,
  metricasCompetidor,
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
  /** Fecha ISO de referencia para el bloque de rendimiento (tests). */
  hoy?: string;
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

/** Días de rendimiento que se resumen para el asistente. */
export const DIAS_RENDIMIENTO = 90;

/**
 * Bloque de rendimiento por competidor (últimos DIAS_RENDIMIENTO días respecto de `hoy`):
 * cifras agregadas + la lectura más reciente (bullets y estrategia). Vacío si no hay datos v2.1.
 */
export function serializarRendimiento(marca: Marca, corridas: readonly Corrida[], hoy: string): string[] {
  const [a, m, d] = hoy.split("-").map(Number) as [number, number, number];
  const desde = new Date(Date.UTC(a, m - 1, d - (DIAS_RENDIMIENTO - 1))).toISOString().slice(0, 10);
  const lineas: string[] = [];
  for (const c of marca.competidores) {
    const r = metricasCompetidor(corridas, c.nombre, { periodo: { desde, hasta: hoy }, hoy });
    if (r.cobertura === "sin-datos" && !r.lecturas.length) continue;
    const n = (x: number | null) => (x === null ? "s/d" : String(x));
    lineas.push(
      `- ${c.nombre}: ${r.posts} posts (${n(r.cadenciaSemanal)}/sem) · seguidores ${n(r.seguidores.actual)} (Δ ${n(r.seguidores.delta)}) · ` +
        `ER prom ${r.er.promedio === null ? "s/d" : `${r.er.promedio}%`} · likes ${r.likes.total} · comentarios ${r.comentarios.total} · ` +
        `vistas ${r.vistas.total} · formatos ${Object.entries(r.formatos).map(([f, k]) => `${f} ${k}`).join(", ") || "s/d"} · cobertura ${r.cobertura}`,
    );
    const ultima = r.lecturas[0];
    if (ultima) {
      lineas.push(`  Lectura (${ultima.fecha}): ${ultima.resumen.join(" | ")}`);
      if (ultima.estrategia) {
        lineas.push(`  Estrategia (confianza ${ultima.estrategia.confianza}): ${ultima.estrategia.hipotesis.join(" | ")}`);
      }
    }
  }
  return lineas;
}

export function serializarContexto(p: PiezasContexto): Contexto {
  const { marca, corridas, soul, entradas } = p;
  const { lineas, incluidas } = seleccionarEntradas(entradas, p.topeEntradas, p.topeCaracteres);
  // Igual que `ultimaCorridaRegistrada`: una histórica mira el pasado y no es «la última corrida».
  const registradas = corridas.filter((c) => c.estado === "registrada" && c.tipo !== "historica");
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
    `# Rendimiento por competidor (últimos ${DIAS_RENDIMIENTO} días; cifras de corridas, no estimadas)`,
    ...(() => {
      const r = serializarRendimiento(marca, corridas, p.hoy ?? fechaLocal(new Date()));
      return r.length ? r : ["(sin datos por publicación todavía)"];
    })(),
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
