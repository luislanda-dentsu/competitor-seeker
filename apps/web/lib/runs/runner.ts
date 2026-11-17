// Solo servidor (Node): nunca importar desde componentes cliente.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  adquirirLock,
  allowedToolsCorrida,
  disallowedToolsCorrida,
  commitYPush,
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
  listarCorridas,
  listarMarcas,
  LockOcupado,
  matarGrupo,
  notificarFinCorrida,
  nuevoIdCorrida,
  procesoVivo,
  pull,
  promptCorrida,
  ultimaCorridaIgRegistrada,
  ultimaCorridaRegistrada,
  type ContenidoLock,
  type Corrida,
  type EventoStream,
} from "@competitor-seeker/core";
import { decidirApifyParaCorrida } from "@/lib/runs/apify";
import { obtenerViva, quitarViva, registrarViva, vivas, type CorridaViva } from "@/lib/runs/registro";
import { rutaFinStream, rutaStream, rutaStreamsMarca } from "@/lib/runs/rutas";

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
  /** Corrida histórica: ventana pasada (ya validada) y tope de posts confirmado para Apify. */
  historica?: { ventana: { desde: string; hasta: string }; topePosts: number };
}

export interface ResultadoLanzar {
  corridaId: string;
  marca: string;
  inicio: string;
}

/** Espera máxima tras SIGTERM antes de escalar a SIGKILL (y tras SIGKILL antes de rendirse). */
const ESPERA_CANCELAR_MS = 5000;
/** Streams más viejos que esto se podan al arrancar el runner. */
export const MAX_EDAD_STREAMS_DIAS = 14;
const ERROR_SERVIDOR_REINICIADO = "servidor reiniciado";

/** Id único aunque se lance dos veces en el mismo minuto para la misma marca (el id ya lleva el slug). */
function idLibre(slug: string): string {
  const base = nuevoIdCorrida(slug);
  if (!existeCorrida(slug, base)) return base;
  for (let n = 2; n < 100; n++) {
    const id = `${base}-${n}`;
    if (!existeCorrida(slug, id)) return id;
  }
  throw new Error("No se pudo generar un id de corrida libre");
}

/** Borra el stream y el marcador `.fin` previos de (marca, id): un stream nunca empieza con restos. */
function limpiarStream(marca: string, corridaId: string): void {
  for (const ruta of [rutaStream(marca, corridaId), rutaFinStream(marca, corridaId)]) {
    try {
      fs.rmSync(ruta, { force: true });
    } catch {
      /* si no se puede borrar, el volcado appendea: preferible a no lanzar */
    }
  }
}

/** Último texto útil del stream (para el mensaje de error de una corrida truncada). */
function ultimoTextoDe(ev: EventoStream, actual: string): string {
  if (ev.type === "result" && typeof ev.result === "string" && ev.result.trim() !== "") return ev.result.trim().slice(0, 500);
  if (ev.type === "cs_error" && typeof ev.texto === "string") return ev.texto.slice(0, 500);
  if (ev.type === "cs_stderr" && typeof ev.texto === "string") return ev.texto.trim().split("\n").slice(-3).join(" ").slice(0, 500);
  return actual;
}

function log(mensaje: string, e?: unknown): void {
  const detalle = e instanceof Error ? ` ${e.message}` : e !== undefined ? ` ${String(e)}` : "";
  console.error(`[runner] ${mensaje}${detalle}`);
}

/**
 * Si `corridas/<id>.json` sigue `en-curso`, lo cierra como `error` con el
 * mensaje. Devuelve la corrida resultante (o null si no existe / no se puede leer).
 */
function cerrarComoError(marca: string, corridaId: string, error: string, ahora: Date = new Date()): Corrida | null {
  let corrida: Corrida;
  try {
    corrida = leerCorrida(marca, corridaId);
  } catch {
    return null;
  }
  if (corrida.estado !== "en-curso") return corrida;
  return guardarCorrida({
    ...corrida,
    estado: "error",
    error,
    fin: ahora.toISOString(),
    duracionMs: Math.max(0, ahora.getTime() - Date.parse(corrida.inicio)),
  });
}

// ---------------------------------------------------------------------------
// Arranque del runner: una vez por proceso de Next (el flag vive en globalThis
// porque `next dev` recarga los módulos).
// ---------------------------------------------------------------------------

type GlobalRunner = typeof globalThis & { __csRunnerArrancado?: boolean };

/** SIGTERM (o la señal dada) al grupo de procesos de cada corrida viva. */
function matarVivas(senal: NodeJS.Signals = "SIGTERM"): void {
  for (const viva of vivas()) {
    viva.cancelada = true;
    if (viva.proceso?.pid) matarGrupo(viva.proceso.pid, senal);
    else viva.controller.abort();
  }
}

/**
 * Al morir el proceso de Next, las corridas vivas no deben quedar huérfanas
 * gastando tokens: SIGTERM a sus grupos. `exit` es síncrono (sirve para
 * `process.exit` de Next); SIGTERM/SIGINT cubren el cierre por señal y, si
 * nadie más los atiende, conservan el comportamiento por defecto (salir).
 */
function instalarSalida(): void {
  process.once("exit", () => matarVivas("SIGTERM"));
  for (const senal of ["SIGTERM", "SIGINT"] as const) {
    process.once(senal, () => {
      matarVivas("SIGTERM");
      if (process.listenerCount(senal) === 0) process.exit(senal === "SIGINT" ? 130 : 143);
    });
  }
}

/**
 * Borra streams (`.stream.jsonl` y `.fin`) con más de `maxEdadDias` días en
 * `data/corridas-vivas/` (tanto los namespaceados por marca como los planos
 * antiguos) y las carpetas de marca que queden vacías. Devuelve cuántos borró.
 */
export function podarStreams(maxEdadDias: number = MAX_EDAD_STREAMS_DIAS, ahora: number = Date.now()): number {
  const raiz = path.dirname(rutaStreamsMarca("x"));
  const limite = ahora - maxEdadDias * 24 * 60 * 60 * 1000;
  let borrados = 0;
  const podarCarpeta = (carpeta: string, recursivo: boolean) => {
    let entradas: fs.Dirent[];
    try {
      entradas = fs.readdirSync(carpeta, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of entradas) {
      const ruta = path.join(carpeta, d.name);
      if (d.isDirectory()) {
        if (recursivo) {
          podarCarpeta(ruta, false);
          try {
            if (fs.readdirSync(ruta).length === 0) fs.rmdirSync(ruta);
          } catch {
            /* la carpeta se queda */
          }
        }
        continue;
      }
      if (!/\.stream\.jsonl(\.fin)?$/.test(d.name)) continue;
      try {
        if (fs.statSync(ruta).mtimeMs < limite) {
          fs.rmSync(ruta, { force: true });
          borrados += 1;
        }
      } catch {
        /* desapareció entre medias */
      }
    }
  };
  podarCarpeta(raiz, true);
  return borrados;
}

/** Poda streams viejos e instala los handlers de salida. Idempotente por proceso. */
export function arrancarRunner(): void {
  const g = globalThis as GlobalRunner;
  if (g.__csRunnerArrancado) return;
  g.__csRunnerArrancado = true;
  try {
    const n = podarStreams();
    if (n > 0) log(`podados ${n} streams con más de ${MAX_EDAD_STREAMS_DIAS} días`);
  } catch (e) {
    log("no se pudieron podar los streams:", e);
  }
  instalarSalida();
}

// ---------------------------------------------------------------------------
// Lanzar
// ---------------------------------------------------------------------------

/**
 * Lanza una corrida headless para la marca. Devuelve en cuanto el proceso
 * arranca; el cierre (corrida, lock) ocurre en segundo plano.
 */
export async function lanzarCorrida(o: OpcionesLanzar): Promise<ResultadoLanzar> {
  arrancarRunner();
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
    const decision = await decidirApifyParaCorrida(o.incluirApify, { historica: !!o.historica });
    const apify = o.historica ? { ...decision, topePosts: o.historica.topePosts } : decision;
    // Fase 6: traer lo de la otra Mac antes de calcular `ultimaCorrida`. Con conflicto la corrida sigue.
    try {
      // Tope de 15 s: una red lenta no deja el lanzamiento colgado (la corrida sigue con lo local).
      await Promise.race([pull({ auto: true }), new Promise((r) => setTimeout(r, 15_000))]);
    } catch (e) {
      log("pull previo a la corrida falló:", e);
    }
    const ultimaCorrida = ultimaCorridaRegistrada(marca.slug);
    guardarCorrida({
      id: corridaId,
      marca: marca.slug,
      fecha: fechaLocal(ahora),
      ultimaCorrida,
      ...(o.historica ? { tipo: "historica" as const, ventana: o.historica.ventana } : {}),
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

    limpiarStream(marca.slug, corridaId);
    const controller = new AbortController();
    const proceso = lanzarClaude({
      prompt: promptCorrida({ marca: marca.slug, fechaCorrida: fechaLocal(ahora), ultimaCorrida, ultimaCorridaIg: ultimaCorridaIgRegistrada(marca.slug), corridaId, apify, ...(o.historica ? { ventana: o.historica.ventana } : {}) }),
      allowedTools: allowedToolsCorrida,
      disallowedTools: disallowedToolsCorrida,
      jsonSchema: esquemaSalidaCorrida,
      name: `corrida-${corridaId}`,
      volcarA: rutaStream(marca.slug, corridaId),
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
    registrarViva(viva);
    viva.terminada = vigilar(viva, proceso.eventos, proceso.salida);
    return { corridaId, marca: marca.slug, inicio };
  } catch (e) {
    liberarLock(corridaId);
    // Si `corridas/<id>.json` quedó en-curso (falló al lanzar el proceso), no puede quedar colgada.
    try {
      cerrarComoError(marca.slug, corridaId, `no se pudo lanzar la corrida: ${(e as Error).message}`);
    } catch (e2) {
      log(`no se pudo cerrar la corrida ${corridaId} tras fallar el lanzamiento:`, e2);
    }
    throw e;
  }
}

type FinProceso = { code: number | null; sessionId?: string; resultado?: string; isError?: boolean };

/** Margen tras el `result` final antes de cerrar un proceso que sigue vivo. */
export const GRACIA_TRAS_RESULTADO_MS = 15_000;

/**
 * Red de seguridad: si el orquestador ya devolvió su `result` y la corrida quedó registrada
 * (o pendiente) pero el proceso sigue vivo (p. ej. un despertador programado), se cierra.
 */
function programarCierreTrasResultado(viva: CorridaViva): void {
  const t = setTimeout(() => {
    try {
      const pid = viva.proceso?.pid;
      if (!pid || viva.proceso?.exitCode !== null) return;
      const c = existeCorrida(viva.marca, viva.corridaId) ? leerCorrida(viva.marca, viva.corridaId) : null;
      if (c && c.estado !== "en-curso") {
        log(`corrida ${viva.corridaId} ya ${c.estado}: cerrando el proceso que seguía vivo`);
        matarGrupo(pid, "SIGTERM");
      }
    } catch (e) {
      log("cierre tras resultado falló:", e);
    }
  }, GRACIA_TRAS_RESULTADO_MS);
  t.unref?.();
}

/** Sigue el proceso hasta el final y cierra la corrida. Nunca rechaza (nada de unhandled rejections). */
async function vigilar(viva: CorridaViva, eventos: AsyncIterable<EventoStream>, salida: Promise<FinProceso>): Promise<void> {
  let ultimoTexto = "";
  let fin: FinProceso = { code: null };
  try {
    try {
      for await (const ev of eventos) {
        ultimoTexto = ultimoTextoDe(ev, ultimoTexto);
        if ((ev as { type?: string }).type === "result") programarCierreTrasResultado(viva);
      }
    } catch (e) {
      log(`stream de la corrida ${viva.corridaId} interrumpido:`, e);
    }
    try {
      fin = await salida;
    } catch (e) {
      fin = { code: null, resultado: (e as Error).message, isError: true };
      ultimoTexto = (e as Error).message;
    }
    try {
      cerrarCorrida(viva, fin, ultimoTexto);
    } catch (e) {
      log(`no se pudo cerrar la corrida ${viva.corridaId}:`, e);
    }
  } catch (e) {
    log(`fallo inesperado vigilando la corrida ${viva.corridaId}:`, e);
  } finally {
    try {
      liberarLock(viva.corridaId);
    } catch (e) {
      log(`no se pudo liberar el lock de ${viva.corridaId}:`, e);
    }
    quitarViva(viva.corridaId);
  }
}

/** Relee la corrida (el orquestador la pudo registrar vía `cs registrar`) y la completa. */
function cerrarCorrida(viva: CorridaViva, fin: FinProceso, ultimoTexto: string): void {
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
  // Fase 6: el cierre no espera a git; el resultado (pushed/error) se anota después en la corrida.
  void sincronizarCierre(actualizada);
  try {
    notificarFinCorrida(actualizada); // Fase 5: campana (corrida-ok / rechazada / ig-sesion / git-error)
  } catch {
    /* una notificación fallida nunca rompe el cierre de la corrida */
  }
}

/** commit + push de los datos de la corrida; anota `git:{pushed,error?}` y nunca lanza. */
async function sincronizarCierre(c: Corrida): Promise<void> {
  try {
    const n = c.entradas.length;
    const r = await commitYPush(`corrida(${c.marca}): ${c.id} — ${n} ${n === 1 ? "entrada" : "entradas"}, ${c.estado}`, { auto: true });
    if (r.ok && r.omitido) return;
    const git = r.ok ? { pushed: true } : { pushed: false, error: r.motivo === "conflicto" ? `conflicto en ${r.archivos.join(", ")}` : `${r.motivo}: ${r.error}` };
    guardarCorrida({ ...leerCorrida(c.marca, c.id), git });
    if (!r.ok) {
      try {
        notificarFinCorrida({ ...c, git });
      } catch {
        /* sin notificación no se rompe el cierre */
      }
    }
  } catch (e) {
    log(`git no sincronizó la corrida ${c.id}:`, e);
  }
}

// ---------------------------------------------------------------------------
// Cancelar
// ---------------------------------------------------------------------------

export interface ResultadoCancelar {
  corridaId: string;
  /**
   * `proceso`: se mató el grupo de procesos (SIGTERM, SIGKILL si hizo falta) y la corrida cerró;
   * `lock`: solo se liberó el lock (proceso ajeno); `huerfana`: en-curso sin proceso, cerrada a mano.
   */
  via: "proceso" | "lock" | "huerfana";
}

function esperar(p: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), ms);
    p.then(
      () => {
        clearTimeout(t);
        resolve(true);
      },
      () => {
        clearTimeout(t);
        resolve(true);
      },
    );
  });
}

/**
 * Cancela una corrida. Viva en este proceso: SIGTERM al grupo, SIGKILL si no
 * termina en 5 s, y solo cuando el runner la cerró se declara cancelada.
 * Sin proceso (lock ajeno o `en-curso` huérfana): se cierra el archivo como `error: cancelada`.
 */
export async function cancelarCorrida(marca: string, corridaId: string): Promise<ResultadoCancelar | null> {
  const viva = obtenerViva(corridaId);
  if (viva && viva.marca === marca) {
    viva.cancelada = true;
    viva.controller.abort(); // → SIGTERM al grupo (runner real) o corta la reproducción (mock)
    let terminada = await esperar(viva.terminada, ESPERA_CANCELAR_MS);
    if (!terminada) {
      log(`la corrida ${corridaId} no terminó tras SIGTERM: SIGKILL al grupo`);
      if (viva.proceso?.pid) matarGrupo(viva.proceso.pid, "SIGKILL");
      terminada = await esperar(viva.terminada, ESPERA_CANCELAR_MS);
    }
    if (!terminada) throw new Error(`La corrida ${corridaId} no terminó ni con SIGKILL; sigue en curso`);
    return { corridaId, via: "proceso" };
  }

  const lock = leerLock();
  if (lock && lock.corridaId === corridaId && lock.marca === marca) {
    // Lock de otro proceso (p. ej. otra instancia de Next): no podemos matar su hijo,
    // pero sí cerrar la corrida y liberar el lock.
    cerrarComoError(marca, corridaId, "cancelada");
    liberarLock(corridaId);
    return { corridaId, via: "lock" };
  }

  // `en-curso` sin proceso ni lock (servidor reiniciado antes de reconciliar): se cierra a mano.
  let corrida: Corrida;
  try {
    corrida = leerCorrida(marca, corridaId);
  } catch {
    return null;
  }
  if (corrida.estado !== "en-curso") return null;
  cerrarComoError(marca, corridaId, "cancelada");
  return { corridaId, via: "huerfana" };
}

// ---------------------------------------------------------------------------
// Estado y reconciliación
// ---------------------------------------------------------------------------

export interface EstadoRunner {
  lock: ContenidoLock | null;
  enCurso: { corridaId: string; marca: string; inicio: string } | null;
  /** Corridas `en-curso` huérfanas cerradas en esta llamada como `error: servidor reiniciado`. */
  reconciliadas: { marca: string; corridaId: string }[];
}

/**
 * Toda corrida `modo: ui` en `en-curso` sin proceso vivo en el registro y sin
 * lock vivo es huérfana (el servidor se reinició con ella a medias): pasa a
 * `error: servidor reiniciado` con `fin`. Si el lock apuntaba a ella y su pid
 * murió, se libera. Devuelve las cerradas.
 */
export function reconciliarHuerfanas(): { marca: string; corridaId: string }[] {
  const cerradas: { marca: string; corridaId: string }[] = [];
  let marcas: { slug: string }[];
  try {
    marcas = listarMarcas();
  } catch (e) {
    log("no se pudieron listar las marcas al reconciliar:", e);
    return cerradas;
  }
  for (const m of marcas) {
    for (const c of listarCorridas(m.slug).corridas) {
      if (c.estado !== "en-curso" || c.modo !== "ui") continue;
      if (obtenerViva(c.id)) continue;
      const lock = leerLock();
      const lockVivo = lock !== null && lock.corridaId === c.id && procesoVivo(lock.pid);
      if (lockVivo) continue;
      try {
        cerrarComoError(m.slug, c.id, ERROR_SERVIDOR_REINICIADO);
        if (lock && lock.corridaId === c.id) liberarLock(c.id);
        cerradas.push({ marca: m.slug, corridaId: c.id });
      } catch (e) {
        log(`no se pudo reconciliar la corrida ${c.id} (${m.slug}):`, e);
      }
    }
  }
  if (cerradas.length) log(`reconciliadas ${cerradas.length} corridas huérfanas: ${cerradas.map((c) => c.corridaId).join(", ")}`);
  return cerradas;
}

/** Lock actual y corrida en curso (viva en este proceso o con lock de un pid vivo). Reconcilia huérfanas antes. */
export function estadoRunner(): EstadoRunner {
  arrancarRunner();
  const reconciliadas = reconciliarHuerfanas();
  const lock = leerLock();
  const viva = vivas()[0];
  if (viva) return { lock, enCurso: { corridaId: viva.corridaId, marca: viva.marca, inicio: viva.inicio }, reconciliadas };
  if (lock && procesoVivo(lock.pid)) return { lock, enCurso: { corridaId: lock.corridaId, marca: lock.marca, inicio: lock.inicio }, reconciliadas };
  return { lock, enCurso: null, reconciliadas };
}
