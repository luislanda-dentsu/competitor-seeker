/**
 * Extractor incremental del bloque de artefacto que emite el asistente:
 *
 *   ```artifact:entradas
 *   {"titulo": "...", "ids": ["...", "..."]}
 *   ```
 *
 * Recibe el texto por deltas y devuelve, en cada `push`, el texto que ya es
 * seguro mostrar (nunca parte del bloque) y los artefactos completos. Retiene
 * el sufijo que podría ser el inicio de una apertura hasta saber si lo es.
 *
 * Puro y sin dependencias: se testea en `artifacts.test.ts`.
 */

export const MARCADOR = "artifact:entradas";
const APERTURA = "```" + MARCADOR;
const CIERRE = "```";

export interface ArtefactoCrudo {
  titulo: string;
  ids: string[];
}

export interface SalidaParser {
  /** Texto visible nuevo (sin el bloque). */
  texto: string;
  artefactos: ArtefactoCrudo[];
  /** Bloques que no se pudieron parsear (se devuelven como texto plano en `texto`). */
  invalidos: string[];
}

/** Longitud del mayor sufijo de `s` que es prefijo de `APERTURA` (sin contar la apertura completa). */
function sufijoCandidato(s: string): number {
  const max = Math.min(s.length, APERTURA.length - 1);
  for (let n = max; n > 0; n--) {
    if (APERTURA.startsWith(s.slice(s.length - n))) return n;
  }
  return 0;
}

/** Parsea el contenido de un bloque: JSON con `titulo` e `ids` (strings). Null si no cumple. */
export function parsearArtefacto(contenido: string): ArtefactoCrudo | null {
  let crudo: unknown;
  const limpio = contenido.trim().replace(/^json\s*/i, "");
  try {
    crudo = JSON.parse(limpio);
  } catch {
    return null;
  }
  if (!crudo || typeof crudo !== "object") return null;
  const { titulo, ids } = crudo as { titulo?: unknown; ids?: unknown };
  if (!Array.isArray(ids)) return null;
  const limpios = ids.filter((i): i is string => typeof i === "string" && i.trim() !== "").map((i) => i.trim());
  const t = typeof titulo === "string" && titulo.trim() !== "" ? titulo.trim() : "Entradas citadas";
  return { titulo: t, ids: [...new Set(limpios)] };
}

export class ParserArtefactos {
  private pendiente = "";
  private dentro = false;

  /** Alimenta un delta y devuelve lo que ya se puede emitir. */
  push(delta: string): SalidaParser {
    this.pendiente += delta;
    const salida: SalidaParser = { texto: "", artefactos: [], invalidos: [] };
    for (;;) {
      if (!this.dentro) {
        const i = this.pendiente.indexOf(APERTURA);
        if (i < 0) {
          const retener = sufijoCandidato(this.pendiente);
          const corte = this.pendiente.length - retener;
          salida.texto += this.pendiente.slice(0, corte);
          this.pendiente = this.pendiente.slice(corte);
          return salida;
        }
        salida.texto += this.pendiente.slice(0, i);
        this.pendiente = this.pendiente.slice(i + APERTURA.length);
        this.dentro = true;
      }
      // Dentro del bloque: esperamos el cierre (tras el fin de la línea de apertura).
      const finLinea = this.pendiente.indexOf("\n");
      if (finLinea < 0) return salida;
      const j = this.pendiente.indexOf(CIERRE, finLinea + 1);
      if (j < 0) return salida;
      const contenido = this.pendiente.slice(finLinea + 1, j);
      this.pendiente = this.pendiente.slice(j + CIERRE.length).replace(/^[ \t]*\r?\n/, "");
      this.dentro = false;
      this.cerrar(contenido, salida);
    }
  }

  /** Fin del stream: vacía lo retenido; un bloque sin cerrar se intenta parsear igual. */
  fin(): SalidaParser {
    const salida: SalidaParser = { texto: "", artefactos: [], invalidos: [] };
    if (this.dentro) {
      const finLinea = this.pendiente.indexOf("\n");
      const contenido = finLinea < 0 ? "" : this.pendiente.slice(finLinea + 1);
      this.dentro = false;
      this.cerrar(contenido, salida);
    } else {
      salida.texto += this.pendiente;
    }
    this.pendiente = "";
    return salida;
  }

  private cerrar(contenido: string, salida: SalidaParser): void {
    const art = parsearArtefacto(contenido);
    if (art) salida.artefactos.push(art);
    else {
      salida.invalidos.push(contenido);
      // Que no se pierda: se muestra como texto plano.
      salida.texto += contenido.trim() ? `\n${contenido.trim()}\n` : "";
    }
  }
}

/** Atajo no incremental: texto limpio + artefactos de una respuesta completa. */
export function extraerArtefactos(texto: string): SalidaParser {
  const p = new ParserArtefactos();
  const a = p.push(texto);
  const b = p.fin();
  return {
    texto: a.texto + b.texto,
    artefactos: [...a.artefactos, ...b.artefactos],
    invalidos: [...a.invalidos, ...b.invalidos],
  };
}
