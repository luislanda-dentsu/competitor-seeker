import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  crearStreamSSE,
  eventosDeLinea,
  formatearSSE,
  leerLineasDesde,
  mensajesDeTexto,
  parsearLastEventId,
  trozoDesde,
} from "./sse";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-sse-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const FASE = (d: string) => JSON.stringify({ type: "system", subtype: "task_progress", description: d });
const DELTA = (t: string) =>
  JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: t } } });

describe("sse: parseo", () => {
  it("parsearLastEventId acepta solo enteros ≥ 0", () => {
    expect(parsearLastEventId(null)).toBe(0);
    expect(parsearLastEventId("")).toBe(0);
    expect(parsearLastEventId(" 42 ")).toBe(42);
    expect(parsearLastEventId("-3")).toBe(0);
    expect(parsearLastEventId("abc")).toBe(0);
    expect(parsearLastEventId("1.5")).toBe(0);
  });

  it("formatearSSE emite id/data y event opcional en una sola línea", () => {
    expect(formatearSSE({ a: 1 }, 10)).toBe('id: 10\ndata: {"a":1}\n\n');
    expect(formatearSSE({ x: "a\nb" }, 3, "fin")).toBe('event: fin\nid: 3\ndata: {"x":"a\\nb"}\n\n');
  });

  it("eventosDeLinea traduce fases, deltas y los cs_* del runner", () => {
    expect(eventosDeLinea(FASE("Rastreo: rastreo-ig:todos"), 0)).toEqual([
      { ts: 0, tipo: "fase", fase: "Rastreo", etiqueta: "rastreo-ig:todos", texto: "Rastreo: rastreo-ig:todos" },
    ]);
    expect(eventosDeLinea(DELTA("hola"), 0)).toEqual([{ ts: 0, tipo: "texto", texto: "hola" }]);
    expect(eventosDeLinea(JSON.stringify({ type: "cs_error", texto: "boom" }), 0)).toEqual([
      { ts: 0, tipo: "info", etiqueta: "error", texto: "boom" },
    ]);
    expect(eventosDeLinea(JSON.stringify({ type: "cs_descartada", texto: "x" }), 0)).toEqual([]);
    expect(eventosDeLinea("no es json", 0)).toEqual([]);
  });
});

describe("sse: lectura por offset", () => {
  it("leerLineasDesde solo devuelve líneas completas y avanza el offset en bytes", () => {
    const ruta = path.join(dir, "s.jsonl");
    const l1 = FASE("Rastreo: rastreo-web:Ñandú");
    fs.writeFileSync(ruta, `${l1}\n{"type":"parcial"`);
    const r = leerLineasDesde(ruta, 0);
    expect(r.lineas).toEqual([l1]);
    expect(r.offset).toBe(Buffer.byteLength(l1, "utf8") + 1);
    // Nada nuevo todavía.
    expect(leerLineasDesde(ruta, r.offset)).toEqual({ lineas: [], offset: r.offset });
    fs.appendFileSync(ruta, `}\n`);
    const r2 = leerLineasDesde(ruta, r.offset);
    expect(r2.lineas).toEqual(['{"type":"parcial"}']);
    expect(r2.offset).toBe(fs.statSync(ruta).size);
    expect(leerLineasDesde(path.join(dir, "no-existe"), 7)).toEqual({ lineas: [], offset: 7 });
  });

  it("mensajesDeTexto asigna a cada evento el offset del final de su línea", () => {
    const l1 = DELTA("á");
    const l2 = FASE("Análisis: analista:intento-1");
    const texto = `${l1}\n\n${l2}\n`;
    const r = mensajesDeTexto(texto, 100, 0);
    const o1 = 100 + Buffer.byteLength(l1, "utf8") + 1;
    const o2 = o1 + 1 + Buffer.byteLength(l2, "utf8") + 1;
    expect(r.offset).toBe(o2);
    expect(r.offset).toBe(100 + Buffer.byteLength(texto, "utf8"));
    expect(r.mensajes).toEqual([
      formatearSSE({ ts: 0, tipo: "texto", texto: "á" }, o1),
      formatearSSE({ ts: 0, tipo: "fase", fase: "Análisis", etiqueta: "analista:intento-1", texto: "Análisis: analista:intento-1" }, o2),
    ]);
  });

  it("trozoDesde reanuda exactamente donde se quedó", () => {
    const ruta = path.join(dir, "s.jsonl");
    fs.writeFileSync(ruta, `${DELTA("a")}\n${DELTA("b")}\n`);
    const t1 = trozoDesde(ruta, 0, 0);
    expect(t1.mensajes.length).toBe(2);
    fs.appendFileSync(ruta, `${DELTA("c")}\n`);
    const t2 = trozoDesde(ruta, t1.offset, 0);
    expect(t2.mensajes).toEqual([formatearSSE({ ts: 0, tipo: "texto", texto: "c" }, fs.statSync(ruta).size)]);
  });
});

describe("sse: stream", () => {
  async function leerTodo(stream: ReadableStream<Uint8Array>): Promise<string> {
    const dec = new TextDecoder();
    let out = "";
    const reader = stream.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      out += dec.decode(value, { stream: true });
    }
    return out;
  }

  it("reproduce lo existente, sigue el archivo y cierra con `fin`", async () => {
    const ruta = path.join(dir, "s.jsonl");
    const rutaFin = `${ruta}.fin`;
    fs.writeFileSync(ruta, `${FASE("Rastreo: rastreo-ig:todos")}\n`);
    const stream = crearStreamSSE({ ruta, rutaFin, desde: 0, intervaloMs: 20, datosFin: () => ({ estado: "registrada" }) });
    setTimeout(() => fs.appendFileSync(ruta, `${DELTA("hola")}\n`), 40);
    setTimeout(() => fs.writeFileSync(rutaFin, "x"), 90);
    const salida = await leerTodo(stream);
    expect(salida.startsWith(": conectado desde 0\n\n")).toBe(true);
    expect(salida).toContain('"tipo":"fase"');
    expect(salida).toContain('"texto":"hola"');
    expect(salida.trimEnd().endsWith(`event: fin\nid: ${fs.statSync(ruta).size}\ndata: {"estado":"registrada"}`)).toBe(true);
    expect(salida.indexOf('"tipo":"fase"')).toBeLessThan(salida.indexOf('"texto":"hola"'));
  });

  it("desde un offset solo emite lo posterior", async () => {
    const ruta = path.join(dir, "s.jsonl");
    const l1 = `${DELTA("viejo")}\n`;
    fs.writeFileSync(ruta, `${l1}${DELTA("nuevo")}\n`);
    fs.writeFileSync(`${ruta}.fin`, "x");
    const salida = await leerTodo(crearStreamSSE({ ruta, rutaFin: `${ruta}.fin`, desde: Buffer.byteLength(l1), intervaloMs: 20 }));
    expect(salida).not.toContain("viejo");
    expect(salida).toContain("nuevo");
    expect(salida).toContain("event: fin");
  });
});
