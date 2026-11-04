import { describe, expect, it } from "vitest";
import { leerSSE, parsearTramasSSE } from "./sse-cliente";

describe("parsearTramasSSE", () => {
  it("parsea event/id/data y deja el resto incompleto", () => {
    const r = parsearTramasSSE('event: delta\nid: 1\ndata: {"t":1}\n\n: ping\n\nevent: done\ndata: {');
    expect(r.tramas).toEqual([{ evento: "delta", id: "1", datos: '{"t":1}' }]);
    expect(r.resto).toBe("event: done\ndata: {");
  });

  it("data multilínea y evento por defecto", () => {
    const r = parsearTramasSSE("data: a\ndata: b\n\n");
    expect(r.tramas).toEqual([{ evento: "message", datos: "a\nb" }]);
  });

  it("tolera CRLF", () => {
    const r = parsearTramasSSE("event: x\r\ndata: 1\r\n\r\n");
    expect(r.tramas[0]).toEqual({ evento: "x", datos: "1" });
  });
});

describe("leerSSE", () => {
  it("itera tramas aunque lleguen partidas entre chunks", async () => {
    const enc = new TextEncoder();
    const trozos = ['event: delta\ndata: "ho', 'la"\n\nevent: do', 'ne\ndata: {}\n\n'];
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const t of trozos) c.enqueue(enc.encode(t));
        c.close();
      },
    });
    const vistas = [];
    for await (const t of leerSSE(stream)) vistas.push(t);
    expect(vistas).toEqual([
      { evento: "delta", datos: '"hola"' },
      { evento: "done", datos: "{}" },
    ]);
  });
});
