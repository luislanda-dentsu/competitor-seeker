/**
 * Metadatos de las señales (enum de agent.md) para la UI.
 * `invalida` no es una señal del enum: es el cubo donde cae cualquier
 * string fuera del enum para que nunca se pinte como algo que no es.
 */
export const SENALES = [
  "nuevo",
  "confuso",
  "sin-datos",
  "no-funciona",
] as const;

export type Senal = (typeof SENALES)[number];
export type SenalUI = Senal | "invalida";

export interface SignalMeta {
  /** Etiqueta en español. */
  label: string;
  /** Descripción corta para tooltips / aria. */
  descripcion: string;
  /** Clases Tailwind: texto fuerte + fondo suave. */
  text: string;
  bg: string;
  /** Color sólido (dot / gráficas). */
  dot: string;
}

export const SIGNAL_META: Record<SenalUI, SignalMeta> = {
  nuevo: {
    label: "Nuevo",
    descripcion: "Movimiento nuevo con evidencia",
    text: "text-s-nuevo",
    bg: "bg-s-nuevo-soft",
    dot: "bg-s-nuevo",
  },
  confuso: {
    label: "Confuso",
    descripcion: "Hay actividad pero la lectura no es clara",
    text: "text-s-confuso",
    bg: "bg-s-confuso-soft",
    dot: "bg-s-confuso",
  },
  "sin-datos": {
    label: "Sin datos",
    descripcion: "No se encontró contenido nuevo desde la última corrida",
    text: "text-s-sin-datos",
    bg: "bg-s-sin-datos-soft",
    dot: "bg-s-sin-datos",
  },
  "no-funciona": {
    label: "No funciona",
    descripcion: "El rastreo falló: no hay evidencia, no significa ausencia de movimientos",
    text: "text-s-no-funciona",
    bg: "bg-s-no-funciona-soft",
    dot: "bg-s-no-funciona",
  },
  invalida: {
    label: "Señal inválida",
    descripcion: "Valor fuera del enum: revisar la entrada del log",
    text: "text-s-invalida",
    bg: "bg-s-invalida-soft",
    dot: "bg-s-invalida",
  },
};

/** Orden de lectura para listas y leyendas. */
export const SENALES_UI: readonly SenalUI[] = [
  "nuevo",
  "confuso",
  "sin-datos",
  "no-funciona",
  "invalida",
];

/**
 * Prioridad para resolver empates (semáforo de competidor):
 * no-funciona > confuso > nuevo > sin-datos. `invalida` queda al final:
 * una señal corrupta no debe ganarle a una legítima.
 */
export const SIGNAL_PRIORITY: Record<SenalUI, number> = {
  "no-funciona": 4,
  confuso: 3,
  nuevo: 2,
  "sin-datos": 1,
  invalida: 0,
};

export function isSenal(v: unknown): v is Senal {
  return typeof v === "string" && (SENALES as readonly string[]).includes(v);
}

/** Normaliza cualquier valor: fuera del enum → `invalida`. */
export function normSenal(v: unknown): SenalUI {
  if (typeof v !== "string") return "invalida";
  const s = v.trim().toLowerCase();
  return isSenal(s) ? s : "invalida";
}

/** Señal dominante de un conjunto, según SIGNAL_PRIORITY. */
export function senalDominante(senales: readonly unknown[]): SenalUI | null {
  let best: SenalUI | null = null;
  for (const raw of senales) {
    const s = normSenal(raw);
    if (best === null || SIGNAL_PRIORITY[s] > SIGNAL_PRIORITY[best]) best = s;
  }
  return best;
}
