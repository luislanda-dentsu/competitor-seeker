/**
 * Funciones puras sobre entradas (sin I/O): agrupación por corrida, filtros,
 * evolución y resolución de slugs. Se testean en `agrupar.test.ts`.
 *
 * Importa solo tipos del core: este módulo lo usan también componentes
 * cliente, que no pueden cargar `node:fs`.
 */
import type { Corrida, Entrada, PuntoSerie, Senal } from "@competitor-seeker/core";

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
    .replace(/[\u0300-\u036f]/g, "")
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
    .replace(/[\u0300-\u036f]/g, "")
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

function ordenarGruposAsc<T extends Entrada>(grupos: readonly GrupoCorrida<T>[]): GrupoCorrida<T>[] {
  return grupos
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.corridaId.localeCompare(b.corridaId)));
}

/** Una fila por corrida (cronológico ascendente) con la señal de cada entrada. */
export function evolucionPorCorrida<T extends Entrada>(
  grupos: readonly GrupoCorrida<T>[],
): PuntoEvolucion[] {
  return ordenarGruposAsc(grupos)
    .map((g) => ({
      corridaId: g.corridaId,
      fecha: g.fecha,
      senales: g.entradas.map((e) => e.senal),
      conteo: contarSenales(g.entradas),
      pctConEvidencia: pctConEvidencia(g.entradas),
    }));
}

/**
 * Serie para la tendencia y la línea de corridas de la Home (cronológico
 * ascendente), construida desde los grupos: incluye corridas no registradas
 * y corridas sin archivo (su fecha es la mayor de sus entradas), de modo que
 * cada entrada del log cuenta en algún punto.
 */
export function serieDesdeGrupos<T extends Entrada>(
  grupos: readonly GrupoCorrida<T>[],
): PuntoSerie[] {
  return ordenarGruposAsc(grupos).map((g) => {
    const c = contarSenales(g.entradas);
    return {
      corridaId: g.corridaId,
      fecha: g.fecha,
      nuevo: c.nuevo,
      confuso: c.confuso,
      sinDatos: c["sin-datos"],
      noFunciona: c["no-funciona"],
    };
  });
}

/** Entradas cuya corrida no tiene archivo en `corridas/`. */
export function contarEntradasSinCorrida<T extends Entrada>(
  grupos: readonly GrupoCorrida<T>[],
): number {
  return grupos.reduce((acc, g) => (g.corrida === null ? acc + g.entradas.length : acc), 0);
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
 * No desambigua colisiones: para eso está `resolverSlugsCompetidores`.
 */
export function slugDeCompetidor(
  nombre: string,
  lista: readonly { slug: string; nombre: string }[],
): string {
  return lista.find((c) => c.nombre === nombre)?.slug ?? slugify(nombre);
}

export interface CompetidorSlug {
  /** Nombre exacto (campo `marca` de las entradas). */
  nombre: string;
  /** Slug único dentro de la marca. */
  slug: string;
  /** true si figura en la lista de vigilancia (`marca.json`). */
  enLista: boolean;
}

/**
 * Competidores visibles de una marca con un slug ÚNICO por nombre exacto.
 * Es la única fuente de verdad para `resumirCompetidores` (ficha, listas,
 * sidebar) y para el proxy (`slugsDeCompetidores`): ambos ven el mismo
 * conjunto.
 *
 * Orden (determinista, también el de asignación de slugs):
 *   1. los de `marca.json` en su orden — reservan su slug aunque estén
 *      inactivos; solo son visibles si están activos o aparecen en el log;
 *   2. los que solo aparecen en el log, en orden alfabético (puntos de
*      código), con `slugify(nombre)`.
 * Un slug repetido ("Coca Cola RD" vs "Coca-Cola RD") recibe sufijo
 * `-2`, `-3`… según ese orden.
 */
export function resolverSlugsCompetidores(
  lista: readonly { slug: string; nombre: string; activo?: boolean }[],
  nombresLog: Iterable<string>,
): CompetidorSlug[] {
  const enLog = new Set(nombresLog);
  const usados = new Set<string>();
  const vistos = new Set<string>();
  const unico = (base: string): string => {
    const raiz = base === "" ? "competidor" : base;
    let slug = raiz;
    for (let n = 2; usados.has(slug); n += 1) slug = `${raiz}-${n}`;
    usados.add(slug);
    return slug;
  };
  const salida: CompetidorSlug[] = [];
  for (const c of lista) {
    if (vistos.has(c.nombre)) continue;
    vistos.add(c.nombre);
    const slug = unico(c.slug);
    if (c.activo === false && !enLog.has(c.nombre)) continue;
    salida.push({ nombre: c.nombre, slug, enLista: true });
  }
  // Orden por puntos de código (no localeCompare): igual en cualquier máquina.
  const soloLog = [...enLog].filter((n) => !vistos.has(n)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const nombre of soloLog) {
    salida.push({ nombre, slug: unico(slugify(nombre)), enLista: false });
  }
  return salida;
}
