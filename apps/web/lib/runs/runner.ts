// Solo servidor (Node): nunca importar desde componentes cliente.

import os from "node:os";
import {
  adquirirLock,
  allowedToolsCorrida,
  competidoresActivos,
  esquemaSalidaCorrida,
  existeCorrida,
  fechaLocal,
  guardarCorrida,
  lanzarClaude,
  leerCorrida,
  leerLock,
  leerMarca,
  liberarLock,
  LockOcupado,
  notificarFinCorrida,
  nuevoIdCorrida,
  procesoVivo,
  promptCorrida,
  ultimaCorridaRegistrada,
  type ContenidoLock,
  type Corrida,
  type EventoStream,
} from "@competitor-seeker/core";
import { decidirApifyParaCorrida } from "@/lib/runs/apify";
import { obtenerViva, quitarViva, registrarViva, vivas, type CorridaViva } from "@/lib/runs/registro";
import { rutaStream } from "@/lib/runs/rutas";

export class CorridaEnCurso extends Error {
  readonly lock: ContenidoLock;
  constructor(lock: ContenidoLock) {
    super(`Ya hay una corrida en curso: ${lock.corridaId} (${lock.marca})`);
    this.name = "CorridaEnCurso";
    this.lock = lock;
  }
}

export interface OpcionesLanzar {
  marca: string;
  incluirApify: boolean;
}

export interface ResultadoLanzar {
  corridaId: string;
  marca: string;
  inicio: string;
}

/** Id único aunque se lance dos veces en el mismo minuto. */
function idLibre(slug: string): string {
  const base = nuevoIdCorrida(slug);
  if (!existeCorrida(slug, base)) return base;
  for (let n = 2; n < 100; n++) {
    const id = `${base}-${n}`;
    if (!existeCorrida(slug, id)) return id;
  }
  throw new Error("No se pudo generar un id de corrida libre");
}

/** Último texto útil del stream (para el mensaje de error de una corrida truncada). */
function ultimoTextoDe(ev: EventoStream, actual: string): string {
  if (ev.type === "result" && typeof ev.result === "string" && ev.result.trim() !== "") return ev.result.trim().slice(0, 500);
  if (ev.type === "cs_error" && typeof ev.texto === "string") return ev.texto.slice(0, 500);
  if (ev.type === "cs_stderr" && typeof ev.texto === "string") return ev.texto.trim().split("\n").slice(-3).join(" ").slice(0, 500);
  return actual;
}

/**
 * Lanza una corrida headless para la marca. Devuelve en cuanto el proceso
 * arranca; el cierre (corrida, lock) ocurre en segundo plano.
 */
export async function lanzarCorrida(o: OpcionesLanzar): Promise<ResultadoLanzar> {
  const marca = leerMarca(o.marca);
  const competidores = competidoresActivos(marca);
  if (competidores.length === 0) throw new Error(`La marca "${marca.slug}" no tiene competidores activos`);

  const corridaId = idLibre(marca.slug);
  try {
    adquirirLock({ corridaId, marca: marca.slug });
  } catch (e) {
    if (e instanceof LockOcupado) throw new CorridaEnCurso(e.lock);
    throw e;
  }

  const ahora = new Date();
  const inicio = ahora.toISOString();
  try {
    const apify = await decidirApifyParaCorrida(o.incluirApify);
    const ultimaCorrida = ultimaCorridaRegistrada(marca.slug);
    guardarCorrida({
      id: corridaId,
      marca: marca.slug,
      fecha: fechaLocal(ahora),
      ultimaCorrida,
      inicio,
      estado: "en-curso",
      verificado: false,
      intentos: 0,
      objeciones: [],
      fuentes: [],
      apify: { resultados: 0, costeEstimadoUsd: 0, omitido: !apify.habilitado, ...(apify.motivo ? { motivo: apify.motivo } : {}) },
      competidores: competidores.map((c) => c.nombre),
      entradas: [],
      modo: "ui",
      maquina: os.hostname(),
    });

    const controller = new AbortController();
    const proceso = lanzarClaude({
      prompt: promptCorrida({ marca: marca.slug, fechaCorrida: fechaLocal(ahora), ultimaCorrida, corridaId, apify }),
      allowedTools: allowedToolsCorrida,
      jsonSchema: esquemaSalidaCorrida,
      name: `corrida-${corridaId}`,
      volcarA: rutaStream(corridaId),
      signal: controller.signal,
    });

    const viva: CorridaViva = {
      corridaId,
      marca: marca.slug,
      inicio,
      controller,
      proceso: proceso.proceso,
      cancelada: false,
      terminada: Promise.resolve(),
    };
    viva.terminada = vigilar(viva, proceso.eventos, proceso.salida);
    registrarViva(viva);
    return { corridaId, marca: marca.slug, inicio };
  } catch (e) {
    liberarLock(corridaId);
    throw e;
  }
}

async function vigilar(
  viva: CorridaViva,
  eventos: AsyncIterable<EventoStream>,
  salida: Promise<{ code: number | null; sessionId?: string; resultado?: string; isError?: boolean }>,
): Promise<void> {
  let ultimoTexto = "";
  try {
    for await (const ev of eventos) ultimoTexto = ultimoTextoDe(ev, ultimoTexto);
  } catch {
    /* la cola se cierra sola al terminar el proceso */
  }
  let fin: { code: number | null; sessionId?: string; resultado?: string; isError?: boolean };
  try {
    fin = await salida;
  } catch (e) {
    fin = { code: null, resultado: (e as Error).message, isError: true };
    ultimoTexto = (e as Error).message;
  }
  try {
    cerrarCorrida(viva, fin, ultimoTexto);
  } finally {
    liberarLock(viva.corridaId);
    quitarViva(viva.corridaId);
  }
}

/** Relee la corrida (el orquestador la pudo registrar vía `cs registrar`) y la completa. */
function cerrarCorrida(
  viva: CorridaViva,
  fin: { code: number | null; sessionId?: string; resultado?: string; isError?: boolean },
  ultimoTexto: string,
): void {
  let corrida: Corrida;
  try {
    corrida = leerCorrida(viva.marca, viva.corridaId);
  } catch {
    return;
  }
  const ahora = new Date();
  const duracionMs = Math.max(0, ahora.getTime() - Date.parse(corrida.inicio));
  const actualizada: Corrida = {
    ...corrida,
    fin: corrida.fin ?? ahora.toISOString(),
    duracionMs: corrida.duracionMs ?? duracionMs,
    ...(fin.sessionId && !corrida.sessionId ? { sessionId: fin.sessionId } : {}),
  };
  if (corrida.estado === "en-curso") {
    actualizada.estado = "error";
    actualizada.fin = ahora.toISOString();
    actualizada.duracionMs = duracionMs;
    const detalle = ultimoTexto || fin.resultado || "";
    actualizada.error = viva.cancelada
      ? "cancelada"
      : `el orquestador terminó (código ${fin.code ?? "?"}) sin registrar la corrida${detalle ? `: ${detalle}` : ""}`;
  }
  guardarCorrida(actualizada);
  try {
    notificarFinCorrida(actualizada); // Fase 5: campana (corrida-ok / rechazada / ig-sesion / git-error)
  } catch {
    /* una notificación fallida nunca rompe el cierre de la corrida */
  }
}

export interface ResultadoCancelar {
  corridaId: string;
  /** `proceso`: se mandó SIGTERM; `lock`: solo se liberó el lock (proceso ajeno). */
  via: "proceso" | "lock";
}

/** Cancela una corrida: SIGTERM al proceso y la corrida queda `error: cancelada`. */
export async function cancelarCorrida(corridaId: string): Promise<ResultadoCancelar | null> {
  const viva = obtenerViva(corridaId);
  if (viva) {
    viva.cancelada = true;
    viva.controller.abort();
    await Promise.race([viva.terminada, new Promise((r) => setTimeout(r, 5000))]);
    return { corridaId, via: "proceso" };
  }
  const lock = leerLock();
  if (!lock || lock.corridaId !== corridaId) return null;
  // Lock de otro proceso (p. ej. otra instancia de Next): no podemos matar su hijo,
  // pero sí cerrar la corrida y liberar el lock.
  try {
    const corrida = leerCorrida(lock.marca, corridaId);
    if (corrida.estado === "en-curso") {
      const ahora = new Date();
      guardarCorrida({
        ...corrida,
        estado: "error",
        error: "cancelada",
        fin: ahora.toISOString(),
        duracionMs: Math.max(0, ahora.getTime() - Date.parse(corrida.inicio)),
      });
    }
  } catch {
    /* sin archivo de corrida: solo liberamos el lock */
  }
  liberarLock(corridaId);
  return { corridaId, via: "lock" };
}

export interface EstadoRunner {
  lock: ContenidoLock | null;
  enCurso: { corridaId: string; marca: string; inicio: string } | null;
}

/** Lock actual y corrida en curso (viva en este proceso o con lock de un pid vivo). */
export function estadoRunner(): EstadoRunner {
  const lock = leerLock();
  const viva = vivas()[0];
  if (viva) return { lock, enCurso: { corridaId: viva.corridaId, marca: viva.marca, inicio: viva.inicio } };
  if (lock && procesoVivo(lock.pid)) return { lock, enCurso: { corridaId: lock.corridaId, marca: lock.marca, inicio: lock.inicio } };
  return { lock, enCurso: null };
}
