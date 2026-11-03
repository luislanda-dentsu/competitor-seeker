/**
 * Formateadores de presentación (español, sin dependencias de zona horaria).
 */

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/**
 * '2026-08-12' → '12 ago 2026'.
 * Parseo manual (sin `Date`) para que un ISO de solo fecha no se desplace
 * por la zona horaria del navegador. Si no es YYYY-MM-DD válido, devuelve
 * la cadena tal cual.
 */
export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const anio = m[1];
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return iso;
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

const intFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

/** 12345 → '12.345'. */
export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return intFmt.format(Math.round(n));
}

/**
 * Porcentaje: recibe una fracción (0.382) o un porcentaje ya escalado si
 * `scaled` es true (38.2). Devuelve '38 %' con el espacio fino en español.
 */
export function fmtPct(
  v: number | null | undefined,
  opts: { decimals?: number; scaled?: boolean } = {},
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const { decimals = 0, scaled = false } = opts;
  const pct = scaled ? v : v * 100;
  const s = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(pct);
  return `${s} %`;
}

/** Duración en ms → '850 ms' · '12 s' · '3 min 20 s' · '1 h 05 min'. */
export function fmtDur(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSeg = Math.round(ms / 1000);
  if (totalSeg < 60) return `${totalSeg} s`;
  const totalMin = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  if (totalMin < 60) return seg ? `${totalMin} min ${seg} s` : `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${h} h ${String(min).padStart(2, "0")} min`;
}
