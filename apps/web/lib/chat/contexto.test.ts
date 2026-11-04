import { describe, expect, it } from "vitest";
import type { Corrida, Entrada, Marca } from "@competitor-seeker/core";
import { seleccionarEntradas, serializarContexto, serializarEntrada } from "./contexto";

function entrada(i: number, fecha: string, senal: Entrada["senal"] = "nuevo"): Entrada {
  return {
    id: i.toString(16).padStart(16, "0"),
    corrida: "c1",
    marca: "Comp",
    fecha,
    senal,
    movimiento: `mov ${i}\ncon salto`,
    lectura: `lec ${i}`,
  };
}

const marca: Marca = {
  slug: "k",
  nombre: "Kola",
  creadaEn: "2026-01-01T00:00:00.000Z",
  competidores: [
    { slug: "a", nombre: "A", url: "https://a.com", instagram: "a_ig", activo: true },
    { slug: "b", nombre: "B", activo: false },
  ],
};

const corrida: Corrida = {
  id: "2026-08-20-x",
  marca: "k",
  fecha: "2026-08-20",
  ultimaCorrida: null,
  inicio: "2026-08-20T10:00:00.000Z",
  estado: "registrada",
  verificado: true,
  intentos: 2,
  objeciones: [],
  fuentes: [],
  competidores: ["A"],
  entradas: [entrada(1, "2026-08-20")],
  modo: "ui",
  maquina: "h",
};

describe("contexto", () => {
  it("serializa una entrada en una línea", () => {
    expect(serializarEntrada(entrada(1, "2026-08-20"))).toBe("0000000000000001 · Comp · 2026-08-20 · nuevo · mov 1 con salto · lec 1");
  });

  it("respeta el tope de entradas quedándose con las más recientes, en orden cronológico", () => {
    const entradas = [entrada(1, "2026-01-01"), entrada(2, "2026-03-01"), entrada(3, "2026-02-01"), entrada(4, "2026-03-01")];
    const r = seleccionarEntradas(entradas, 2);
    expect(r.incluidas).toBe(2);
    expect(r.lineas.map((l) => l.slice(0, 16))).toEqual(["0000000000000002", "0000000000000004"]);
  });

  it("respeta el tope de caracteres", () => {
    const entradas = [entrada(1, "2026-01-01"), entrada(2, "2026-02-01"), entrada(3, "2026-03-01")];
    const una = serializarEntrada(entradas[0]!).length + 1;
    const r = seleccionarEntradas(entradas, 400, una * 2);
    expect(r.incluidas).toBe(2);
    expect(r.lineas[1]!.startsWith("0000000000000003")).toBe(true);
  });

  it("incluye marca, corridas, soul y entradas; calcula la última corrida", () => {
    const c = serializarContexto({ marca, corridas: [corrida], soul: "## Criterio\n- no alucines", entradas: [entrada(1, "2026-08-20")] });
    expect(c.ultimaCorrida).toBe("2026-08-20");
    expect(c.total).toBe(1);
    expect(c.texto).toContain("# Marca: Kola (k)");
    expect(c.texto).toContain("- A · https://a.com · @a_ig");
    expect(c.texto).toContain("- B · INACTIVO");
    expect(c.texto).toContain("- 2026-08-20-x · 2026-08-20 · registrada · intentos 2 · verificada · 1 entradas");
    expect(c.texto).toContain("- no alucines");
    expect(c.texto).toContain("0000000000000001 · Comp · 2026-08-20 · nuevo");
  });

  it("incluye el rendimiento por competidor con la lectura y la estrategia más recientes", () => {
    const conDatos: Corrida = {
      ...corrida,
      id: "2026-11-01-y",
      fecha: "2026-11-01",
      publicaciones: [{ competidor: "A", url: "https://www.instagram.com/p/Q1/", fecha: "2026-10-30", formato: "reel", likes: 90, comentarios: 10, fuente: "apify" }],
      perfiles: [{ competidor: "A", seguidores: 1000, fuente: "apify" }],
      lecturas: [
        {
          competidor: "A",
          resumen: ["Reel de lanzamiento"],
          estrategia: { hipotesis: ["Empuja producto nuevo"], pilares: [], formatosYCadencia: "Reels", implicaciones: [], confianza: "baja", postsCitados: [] },
        },
      ],
    };
    const c = serializarContexto({ marca, corridas: [corrida, conDatos], soul: "", entradas: [], hoy: "2026-11-04" });
    expect(c.texto).toContain("# Rendimiento por competidor (últimos 90 días");
    expect(c.texto).toContain("- A: 1 posts");
    expect(c.texto).toContain("ER prom 10%");
    expect(c.texto).toContain("Lectura (2026-11-01): Reel de lanzamiento");
    expect(c.texto).toContain("Estrategia (confianza baja): Empuja producto nuevo");
    expect(c.texto).not.toContain("- B: ");
  });

  it("log vacío y sin corridas", () => {
    const c = serializarContexto({ marca, corridas: [], soul: "", entradas: [] });
    expect(c.ultimaCorrida).toBeNull();
    expect(c.texto).toContain("(ninguna corrida)");
    expect(c.texto).toContain("el log está vacío");
    expect(c.texto).toContain("(sin datos por publicación todavía)");
  });
});
