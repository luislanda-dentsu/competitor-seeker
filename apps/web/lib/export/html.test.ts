import { describe, expect, it } from "vitest";
import type { Entrada, MetricasCompetidor } from "@competitor-seeker/core";
import { generarHtmlExport, jsonParaScript, leerPlantillaExport, rendimientoExport } from "./html";

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

describe("jsonParaScript · comentarios HTML", () => {
  it("neutraliza <!-- para que no altere el cierre del <script>", async () => {
    const { jsonParaScript } = await import("./html");
    const out = jsonParaScript({ t: "a <!--<script> b" });
    expect(out).not.toContain("<!--");
    expect(JSON.parse(out)).toEqual({ t: "a <!--<script> b" });
  });
});

describe("rendimiento en el export", () => {
  const metricas = {
    competidor: "Marca A",
    publicaciones: [],
    posts: 4,
    cadenciaSemanal: 1.5,
    likes: { total: 400, promedio: 100, n: 4 },
    comentarios: { total: 20, promedio: 5, n: 4 },
    vistas: { total: 0, promedio: null, n: 0, mediana: null },
    er: { promedio: 1.05, porFormato: {} },
    formatos: { reel: 3, carrusel: 1 },
    seguidores: { actual: 10_000, delta: 250 },
    top: [1, 2, 3, 4].map((i) => ({ url: `https://www.instagram.com/p/P${i}/`, fecha: "2026-11-0" + i, formato: "reel", er: i, corrida: "c1", competidor: "Marca A" })),
    cobertura: "completa",
    conCifras: 4,
    serie: [{ corrida: "c1", fecha: "2026-11-04", seguidores: 10_000, posts: 4, erPromedio: 1.05 }],
    lecturas: [{ corrida: "c1", fecha: "2026-11-04", resumen: ["x"] }],
  } as unknown as MetricasCompetidor;

  it("rendimientoExport proyecta cifras y recorta el top a 3, sin series ni lecturas", () => {
    const r = rendimientoExport(metricas);
    expect(r).toMatchObject({ competidor: "Marca A", posts: 4, erPromedio: 1.05, likesPromedio: 100, seguidores: 10_000, deltaSeguidores: 250, cobertura: "completa" });
    expect(r.top).toHaveLength(3);
    expect(r.top[0]).toEqual({ url: "https://www.instagram.com/p/P1/", fecha: "2026-11-01", formato: "reel", er: 1 });
    expect(r).not.toHaveProperty("serie");
    expect(r).not.toHaveProperty("lecturas");
  });

  it("el bloque DATOS lleva `rendimiento` (vacío por defecto)", () => {
    const datosDe = (html: string) => JSON.parse(html.match(/id="datos">([\s\S]*?)<\/script>/)![1]!);
    expect(datosDe(generarHtmlExport(PLANTILLA, "2026-11-01", [])).rendimiento).toEqual([]);
    const conR = datosDe(generarHtmlExport(PLANTILLA, "2026-11-01", [entrada("Reel")], [rendimientoExport(metricas)]));
    expect(conR.rendimiento[0].competidor).toBe("Marca A");
  });

  it("la plantilla real conserva el bloque y su script compila", () => {
    const html = generarHtmlExport(leerPlantillaExport(), "2026-11-01", [entrada("Reel")], [rendimientoExport(metricas)]);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(() => new Function(s)).not.toThrow();
    expect(html).toContain("bloqueRendimiento");
  });
});
