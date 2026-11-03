/**
 * Reducción pura (sin I/O, válida en cliente y servidor) de los `EventoCorrida`
 * del stream a lo que pinta la consola: líneas con prefijo y estado de las fases.
 */
import type { EventoCorrida } from "@competitor-seeker/core";

export const FASES = ["Rastreo", "Análisis", "Verificación"] as const;
export type Fase = (typeof FASES)[number];
export type EstadoFase = "pendiente" | "activo" | "ok" | "error";

export interface LineaConsola {
  /** Epoch ms. */
  ts: number;
  /** Prefijo entre corchetes: `[rastreo-ig]`, `[analista:1]`… */
  prefijo: string;
  texto: string;
  tipo: EventoCorrida["tipo"];
}

export interface ResumenFin {
  corridaId?: string;
  marca?: string;
  estado?: string;
  verificado?: boolean;
  intentos?: number;
  entradas?: number;
  objeciones?: { marca: string; problema: string }[];
  duracionMs?: number;
  apify?: { resultados?: number; costeEstimadoUsd?: number; motivo?: string | null };
  error?: string;
  ig?: { sesion?: string };
  resultado?: string;
}

export interface EstadoConsola {
  lineas: LineaConsola[];
  fases: Record<Fase, EstadoFase>;
  /** Intentos de verificación vistos (máximo `intento-N`). */
  intentosVerificacion: number;
  fin: ResumenFin | null;
  /** Último texto del orquestador (para el mensaje de error de una corrida truncada). */
  ultimoTexto: string;
}

export function estadoInicial(): EstadoConsola {
  return {
    lineas: [],
    fases: { Rastreo: "pendiente", Análisis: "pendiente", Verificación: "pendiente" },
    intentosVerificacion: 0,
    fin: null,
    ultimoTexto: "",
  };
}

const NOMBRES: Record<string, string> = {
  verificacion: "verificador",
  "rastreo-web": "rastreo-web",
  "rastreo-ig": "rastreo-ig",
  "rastreo-apify": "rastreo-apify",
  analista: "analista",
};

/** `analista:intento-2` → `{ prefijo: "[analista:2]", texto: "intento 2" }`. */
export function prefijoDeEtiqueta(etiqueta: string | undefined, fase: string | undefined): { prefijo: string; texto: string } {
  if (!etiqueta) return { prefijo: `[${(fase ?? "fase").toLowerCase()}]`, texto: fase ?? "" };
  const sep = etiqueta.indexOf(":");
  const nombreCrudo = sep >= 0 ? etiqueta.slice(0, sep).trim() : etiqueta.trim();
  const resto = sep >= 0 ? etiqueta.slice(sep + 1).trim() : "";
  const nombre = NOMBRES[nombreCrudo] ?? nombreCrudo;
  const intento = /^intento-(\d+)$/.exec(resto);
  if (intento) return { prefijo: `[${nombre}:${intento[1]}]`, texto: `intento ${intento[1]}` };
  if (nombreCrudo === "rastreo-ig" && resto === "todos") return { prefijo: `[${nombre}]`, texto: "todos los perfiles" };
  return { prefijo: `[${nombre}]`, texto: resto || nombre };
}

export function intentoDeEtiqueta(etiqueta: string | undefined): number | null {
  const m = /intento-(\d+)/.exec(etiqueta ?? "");
  return m ? Number(m[1]) : null;
}

function esFase(v: unknown): v is Fase {
  return typeof v === "string" && (FASES as readonly string[]).includes(v);
}

function lineaDe(ev: EventoCorrida): LineaConsola | null {
  switch (ev.tipo) {
    case "fase": {
      const { prefijo, texto } = prefijoDeEtiqueta(ev.etiqueta, ev.fase);
      return { ts: ev.ts, prefijo, texto: `${ev.fase ?? ""} · ${texto}`.replace(/^ · /, ""), tipo: ev.tipo };
    }
    case "texto":
      return ev.texto.trim() === "" ? null : { ts: ev.ts, prefijo: "[orquestador]", texto: ev.texto, tipo: ev.tipo };
    case "agente":
      return { ts: ev.ts, prefijo: "[agente]", texto: ev.texto, tipo: ev.tipo };
    case "tool":
      return { ts: ev.ts, prefijo: "[tool]", texto: ev.texto, tipo: ev.tipo };
    case "denegado":
      return { ts: ev.ts, prefijo: "[denegado]", texto: ev.texto, tipo: ev.tipo };
    case "info": {
      const etiqueta = typeof ev.etiqueta === "string" ? ev.etiqueta : "sistema";
      return { ts: ev.ts, prefijo: `[${etiqueta}]`, texto: ev.texto, tipo: ev.tipo };
    }
    case "fin": {
      const err = ev.extra?.is_error === true;
      return { ts: ev.ts, prefijo: "[fin]", texto: ev.texto || (err ? "El proceso terminó con error" : "Proceso terminado"), tipo: ev.tipo };
    }
    default:
      return null;
  }
}

/** Aplica un evento del stream. Devuelve un estado nuevo (no muta). */
export function reducirConsola(estado: EstadoConsola, ev: EventoCorrida): EstadoConsola {
  let { lineas, fases, intentosVerificacion, ultimoTexto } = estado;
  const linea = lineaDe(ev);

  if (ev.tipo === "texto") {
    const ultima = lineas[lineas.length - 1];
    if (linea && ultima && ultima.tipo === "texto") {
      // Los deltas del orquestador se funden en una sola línea.
      lineas = [...lineas.slice(0, -1), { ...ultima, texto: ultima.texto + ev.texto }];
      ultimoTexto = ultima.texto + ev.texto;
    } else if (linea) {
      lineas = [...lineas, linea];
      ultimoTexto = ev.texto;
    }
  } else if (linea) {
    lineas = [...lineas, linea];
  }

  if (ev.tipo === "fase" && esFase(ev.fase)) {
    // Activar la fase i deja las anteriores en ok y las posteriores en pendiente:
    // si el flujo vuelve atrás (reintento del analista tras una verificación), lo refleja.
    const idx = FASES.indexOf(ev.fase);
    const nuevas = { ...fases };
    FASES.forEach((f, i) => {
      if (i < idx) nuevas[f] = "ok";
      else if (i === idx) nuevas[f] = "activo";
      else nuevas[f] = "pendiente";
    });
    fases = nuevas;
    if (ev.fase === "Verificación") {
      const n = intentoDeEtiqueta(ev.etiqueta);
      if (n !== null && n > intentosVerificacion) intentosVerificacion = n;
    }
  }

  return { lineas, fases, intentosVerificacion, fin: estado.fin, ultimoTexto };
}

/**
 * Cierra el estado con el resumen final: fases en ok; la activa en error si la
 * corrida falló; Verificación en error si quedó `pendiente-confirmacion`
 * (el verificador no la dio por buena: no es una fase completada).
 */
export function cerrarConsola(estado: EstadoConsola, fin: ResumenFin): EstadoConsola {
  const fallo = fin.estado === "error";
  const sinVerificar = fin.estado === "pendiente-confirmacion";
  const fases = { ...estado.fases };
  for (const f of FASES) {
    if (fallo) {
      if (fases[f] === "activo") fases[f] = "error";
    } else if (fases[f] !== "pendiente" || (fin.estado && fin.estado !== "en-curso")) {
      fases[f] = "ok";
    }
  }
  if (sinVerificar) fases["Verificación"] = "error";
  const intentos = typeof fin.intentos === "number" && fin.intentos > estado.intentosVerificacion ? fin.intentos : estado.intentosVerificacion;
  return { ...estado, fases, intentosVerificacion: intentos, fin };
}

/** Reduce una lista completa de eventos (consola grabada). */
export function reducirTodo(eventos: readonly EventoCorrida[], fin?: ResumenFin | null): EstadoConsola {
  let estado = estadoInicial();
  for (const ev of eventos) estado = reducirConsola(estado, ev);
  return fin ? cerrarConsola(estado, fin) : estado;
}

/** HH:MM:SS local. */
export function horaDe(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
