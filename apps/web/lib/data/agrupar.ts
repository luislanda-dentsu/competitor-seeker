/**
 * Funciones puras sobre entradas (sin I/O): agrupación por corrida, filtros,
 * evolución y resolución de slugs. Se testean en `agrupar.test.ts`.
 *
 * Importa solo tipos del core: este módulo lo usan también componentes
 * cliente, que no pueden cargar `node:fs`.
 */
import type { Corrida, Entrada, Senal } from "@competitor-seeker/core";

export const SENALES_ORDEN: readonly Senal[] = [
  "nuevo",
  "confuso",
  "sin-datos",
  "no-funciona",
];

export type ConteoSenales = Record<Senal, number>;

export function conteoVacio(): ConteoSenales {
  return { nuevo: 0, confuso: 0, "sin-datos": 0, "no-funciona": 0 };
}

export function contarSenales(
  entradas: readonly Pick<Entrada, "senal">[],
): ConteoSenales {
  const c = conteoVacio();
  for (const e of entradas) c[e.senal] += 1;
  return c;
}

/** % de entradas cuya señal no es `sin-datos` (0–100, un decimal). */
export function pctConEvidencia(
  entradas: readonly Pick<Entrada, "senal">[],
): number {
  if (entradas.length === 0) return 0;
  const con = entradas.filter((e) => e.senal !== "sin-datos").length;
  return Math.round((con / entradas.length) * 1000) / 10;
}

/** Minúsculas, sin acentos, solo [a-z0-9] separados por guiones (igual que core). */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Orden descendente por fecha; empate → orden de aparición estable. */
export function ordenarPorFechaDesc<T extends { fecha: string }>(
  entradas: readonly T[],
): T[] {
  return entradas
    .map((e, i) => ({ e, i }))
    .sort((a, b) =>
      a.e.fecha < b.e.fecha ? 1 : a.e.fecha > b.e.fecha ? -1 : a.i - b.i,
    )
    .map(({ e }) => e);
}

export interface GrupoCorrida<T extends Entrada = Entrada> {
  corridaId: string;
  /** Fecha de la corrida si existe su archivo; si no, la mayor fecha de sus entradas. */
  fecha: string;
  /** Metadatos de la corrida (null si el archivo no existe o es inválido). */
  corrida: Pick<Corrida, "id" | "fecha" | "estado" | "verificado" | "intentos" | "modo"> | null;
  entradas: T[];
}

/**
 * Agrupa entradas por `corrida`, grupos ordenados por fecha descendente y
 * entradas dentro de cada grupo también por fecha descendente. Una entrada
 * cuya corrida no tiene archivo sigue apareciendo (grupo sin metadatos).
 */
export function agruparPorCorrida<T extends Entrada>(
  entradas: readonly T[],
  corridas: readonly Corrida[] = [],
): GrupoCorrida<T>[] {
  const porId = new Map(corridas.map((c) => [c.id, c] as const));
  const grupos = new Map<string, T[]>();
  for (const e of entradas) {
    const lista = grupos.get(e.corrida);
    if (lista) lista.push(e);
    else grupos.set(e.corrida, [e]);
  }
  const salida: GrupoCorrida<T>[] = [];
  for (const [corridaId, lista] of grupos) {
    const c = porId.get(corridaId) ?? null;
    const fecha =
      c?.fecha ?? lista.reduce((max, e) => (e.fecha > max ? e.fecha : max), "");
    salida.push({
      corridaId,
      fecha,
      corrida: c
        ? { id: c.id, fecha: c.fecha, estado: c.estado, verificado: c.verificado, intentos: c.intentos, modo: c.modo }
        : null,
      entradas: ordenarPorFechaDesc(lista),
    });
  }
  return salida.sort((a, b) =>
    a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.corridaId.localeCompare(a.corridaId),
  );
}

export interface FiltroEntradas {
  /** Señales admitidas; vacío o undefined → todas. */
  senales?: readonly Senal[];
  /** Búsqueda en movimiento y lectura (sin acentos, sin mayúsculas). */
  texto?: string;
}

function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarEntradas<T extends Pick<Entrada, "senal" | "movimiento" | "lectura">>(
  entradas: readonly T[],
  filtro: FiltroEntradas,
): T[] {
  const senales = filtro.senales && filtro.senales.length > 0 ? new Set(filtro.senales) : null;
  const q = filtro.texto ? normalizarTexto(filtro.texto) : "";
  return entradas.filter((e) => {
    if (senales && !senales.has(e.senal)) return false;
    if (q === "") return true;
    return normalizarTexto(`${e.movimiento} ${e.lectura}`).includes(q);
  });
}

/** Aplica el filtro grupo a grupo y descarta los grupos que quedan vacíos. */
export function filtrarGrupos<T extends Entrada>(
  grupos: readonly GrupoCorrida<T>[],
  filtro: FiltroEntradas,
): GrupoCorrida<T>[] {
  return grupos
    .map((g) => ({ ...g, entradas: filtrarEntradas(g.entradas, filtro) }))
    .filter((g) => g.entradas.length > 0);
}

export interface PuntoEvolucion {
  corridaId: string;
  fecha: string;
  /** Señal de cada entrada, en el orden del grupo. */
  senales: Senal[];
  conteo: ConteoSenales;
  pctConEvidencia: number;
}

/** Una fila por corrida (cronológico ascendente) con la señal de cada entrada. */
export function evolucionPorCorrida<T extends Entrada>(
  grupos: readonly GrupoCorrida<T>[],
): PuntoEvolucion[] {
  return grupos
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.corridaId.localeCompare(b.corridaId)))
    .map((g) => ({
      corridaId: g.corridaId,
      fecha: g.fecha,
      senales: g.entradas.map((e) => e.senal),
      conteo: contarSenales(g.entradas),
      pctConEvidencia: pctConEvidencia(g.entradas),
    }));
}

/** URLs de evidencia únicas, conservando el orden de aparición. */
export function enlacesEvidencia(entradas: readonly Pick<Entrada, "evidencia">[]): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const e of entradas) {
    for (const url of e.evidencia ?? []) {
      if (vistas.has(url)) continue;
      vistas.add(url);
      salida.push(url);
    }
  }
  return salida;
}

/**
 * Resuelve el slug de un competidor a partir de su nombre (campo `marca` de
 * la entrada): primero la lista de vigilancia, si no `slugify(nombre)`.
 */
export function slugDeCompetidor(
  nombre: string,
  lista: readonly { slug: string; nombre: string }[],
): string {
  return lista.find((c) => c.nombre === nombre)?.slug ?? slugify(nombre);
}
