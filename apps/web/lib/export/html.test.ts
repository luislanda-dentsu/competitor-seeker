import { describe, expect, it } from "vitest";
import type { Entrada } from "@competitor-seeker/core";
import { generarHtmlExport, jsonParaScript } from "./html";

const PLANTILLA = `<html><body>
<!-- INICIO DATOS · reemplazar -->
<script type="application/json" id="datos">{"demo": true, "corrida": "x", "entradas": []}</script>
<!-- FIN DATOS -->
<script>var otro = 1;</script></body></html>`;

const entrada = (movimiento: string): Entrada => ({
  id: "0123456789abcdef",
  corrida: "c1",
  marca: "Marca A",
  fecha: "2026-11-01",
  movimiento,
  senal: "nuevo",
  lectura: "Lectura",
});

describe("generarHtmlExport", () => {
  it("reemplaza el bloque y deja JSON parseable sin id/corrida/demo", () => {
    const html = generarHtmlExport(PLANTILLA, "2026-11-01", [entrada("Reel")]);
    const m = html.match(/<script type="application\/json" id="datos">([\s\S]*?)<\/script>/);
    const datos = JSON.parse(m![1]!);
    expect(datos.corrida).toBe("2026-11-01");
    expect(datos.demo).toBeUndefined();
    expect(datos.entradas).toEqual([{ marca: "Marca A", fecha: "2026-11-01", movimiento: "Reel", senal: "nuevo", lectura: "Lectura" }]);
    expect(html).toContain("var otro = 1;");
    expect(html).not.toContain('"demo"');
  });

  it("no permite inyectar </script>", () => {
    const html = generarHtmlExport(PLANTILLA, "2026-11-01", [entrada("</script><script>alert(1)</script>")]);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    const m = html.match(/id="datos">([\s\S]*?)<\/script>/);
    expect(JSON.parse(m![1]!).entradas[0].movimiento).toBe("</script><script>alert(1)</script>");
  });

  it("falla si la plantilla no tiene el bloque", () => {
    expect(() => generarHtmlExport("<html></html>", "2026-11-01", [])).toThrow();
  });

  it("escapa </ en jsonParaScript", () => {
    expect(jsonParaScript("</a>")).toBe('"<\\/a>"');
  });
});
