/**
 * Server-Sent Events sobre el stream `.jsonl` de una corrida viva.
 *
 * - Cada evento SSE lleva `id: <offset en bytes>` del final de la línea que lo
 *   produjo; el cliente reconecta con `Last-Event-ID` (o `?desde=`) y recibe
 *   solo lo que falta.
 * - El archivo se sigue con `fs.watch` + sondeo cada 500 ms (watch no es
 *   fiable en todos los FS).
 * - Cuando existe `<ruta>.fin` se emite `event: fin` y se cierra.
 *
 * Las funciones de parseo/formato son puras para poder testearlas.
 */
import fs from "node:fs";
import { parsearEvento, resumirEventos, type EventoCorrida } from "@competitor-seeker/core";

/** `Last-Event-ID` → offset en bytes (entero ≥ 0); cualquier otra cosa → 0. */
export function parsearLastEventId(valor: string | null | undefined): number {
  if (!valor) return 0;
  const n = Number(valor.trim());
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** Un mensaje SSE: `event:` opcional, `id:` y `data:` JSON en una línea. */
export function formatearSSE(datos: unknown, id: number, evento?: string): string {
  const cuerpo = JSON.stringify(datos).replace(/\r?\n/g, " ");
  return `${evento ? `event: ${evento}\n` : ""}id: ${id}\ndata: ${cuerpo}\n\n`;
}

export interface LecturaLineas {
  /** Líneas completas (sin `\n`) desde el offset. */
  lineas: string[];
  /** Offset tras la última línea completa; igual a `desde` si no había nada nuevo. */
  offset: number;
}

/** Texto bruto desde `desde` hasta el último `\n` completo (nunca parte una línea ni un carácter). */
export function leerBrutoDesde(ruta: string, desde: number): { texto: string; offset: number } {
  let fd: number;
  try {
    fd = fs.openSync(ruta, "r");
  } catch {
    return { texto: "", offset: desde };
  }
  try {
    const tamano = fs.fstatSync(fd).size;
    if (tamano <= desde) return { texto: "", offset: desde };
    const buf = Buffer.alloc(tamano - desde);
    const leidos = fs.readSync(fd, buf, 0, buf.length, desde);
    const util = buf.subarray(0, leidos);
    const ultimoSalto = util.lastIndexOf(0x0a);
    if (ultimoSalto < 0) return { texto: "", offset: desde };
    return { texto: util.subarray(0, ultimoSalto + 1).toString("utf8"), offset: desde + ultimoSalto + 1 };
  } finally {
    fs.closeSync(fd);
  }
}

/** Líneas completas (limpias, no vacías) del archivo a partir de `desde` (bytes). Si no existe, nada. */
export function leerLineasDesde(ruta: string, desde: number): LecturaLineas {
  const { texto, offset } = leerBrutoDesde(ruta, desde);
  if (texto === "") return { lineas: [], offset };
  const lineas = texto.split("\n").slice(0, -1).map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");
  return { lineas, offset };
}

/** Traduce una línea cruda del stream a eventos de consola (incluye los `cs_*` del runner). */
export function eventosDeLinea(linea: string, ts: number = Date.now()): EventoCorrida[] {
  const ev = parsearEvento(linea);
  if (!ev) return [];
  if (ev.type === "cs_error") return [{ ts, tipo: "info", etiqueta: "error", texto: String(ev.texto ?? "error del runner") }];
  if (ev.type === "cs_stderr") return [{ ts, tipo: "info", etiqueta: "stderr", texto: String(ev.texto ?? "").trim() }];
  if (ev.type === "cs_descartada") return [];
  return resumirEventos(ev, ts);
}

export interface TrozoSSE {
  /** Mensajes SSE ya formateados, en orden. */
  mensajes: string[];
  offset: number;
}

/** Formatea un bloque de texto bruto que empieza en `desde`: cada evento lleva el offset del final de su línea. */
export function mensajesDeTexto(texto: string, desde: number, ts: number = Date.now()): TrozoSSE {
  const mensajes: string[] = [];
  let acumulado = desde;
  for (const cruda of texto.split("\n").slice(0, -1)) {
    acumulado += Buffer.byteLength(cruda, "utf8") + 1;
    const limpia = cruda.replace(/\r$/, "");
    if (limpia.trim() === "") continue;
    for (const ev of eventosDeLinea(limpia, ts)) mensajes.push(formatearSSE(ev, acumulado));
  }
  return { mensajes, offset: acumulado };
}

/** Lee lo nuevo desde `desde` y lo formatea: todos los eventos de una línea comparten su `id`. */
export function trozoDesde(ruta: string, desde: number, ts: number = Date.now()): TrozoSSE {
  const { texto, offset } = leerBrutoDesde(ruta, desde);
  if (texto === "") return { mensajes: [], offset };
  return mensajesDeTexto(texto, desde, ts);
}

export interface OpcionesStreamSSE {
  ruta: string;
  rutaFin: string;
  desde: number;
  signal?: AbortSignal;
  intervaloMs?: number;
  /** Datos del evento `fin` (p. ej. el resumen de la corrida ya cerrada). */
  datosFin?: () => Promise<unknown> | unknown;
  /** Si el archivo nunca aparece y esto devuelve true, se cierra con `fin`. */
  abandonada?: () => boolean;
}

/** ReadableStream de bytes SSE que reproduce el archivo desde `desde` y lo sigue hasta `.fin`. */
export function crearStreamSSE(o: OpcionesStreamSSE): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const intervalo = o.intervaloMs ?? 500;
  let offset = o.desde;
  let cerrado = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let watcher: fs.FSWatcher | null = null;
  let vaciando = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const enviar = (s: string) => {
        if (cerrado) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          cerrar();
        }
      };
      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        if (timer) clearInterval(timer);
        if (ping) clearInterval(ping);
        watcher?.close();
        o.signal?.removeEventListener("abort", cerrar);
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      };
      const vaciar = async () => {
        if (cerrado || vaciando) return;
        vaciando = true;
        try {
          const t = trozoDesde(o.ruta, offset);
          for (const m of t.mensajes) enviar(m);
          offset = t.offset;
          if (fs.existsSync(o.rutaFin)) {
            // Lo que haya quedado tras el marcador.
            const resto = trozoDesde(o.ruta, offset);
            for (const m of resto.mensajes) enviar(m);
            offset = resto.offset;
            let datos: unknown = {};
            try {
              datos = (await o.datosFin?.()) ?? {};
            } catch (e) {
              datos = { error: (e as Error).message };
            }
            enviar(formatearSSE(datos, offset, "fin"));
            cerrar();
          } else if (!fs.existsSync(o.ruta) && o.abandonada?.()) {
            enviar(formatearSSE({ estado: "error", error: "sin stream" }, offset, "fin"));
            cerrar();
          }
        } finally {
          vaciando = false;
        }
      };

      enviar(`: conectado desde ${offset}\n\n`);
      void vaciar();
      timer = setInterval(() => void vaciar(), intervalo);
      ping = setInterval(() => enviar(": ping\n\n"), 15_000);
      try {
        if (fs.existsSync(o.ruta)) watcher = fs.watch(o.ruta, () => void vaciar());
      } catch {
        watcher = null;
      }
      if (o.signal) {
        if (o.signal.aborted) cerrar();
        else o.signal.addEventListener("abort", cerrar, { once: true });
      }
    },
    cancel() {
      cerrado = true;
      if (timer) clearInterval(timer);
      if (ping) clearInterval(ping);
      watcher?.close();
    },
  });
}
