import { describe, expect, it } from "vitest";
import { inlineATexto, parsearInline, parsearMarkdown } from "./markdown";

describe("markdown", () => {
  it("párrafos separados por línea en blanco; líneas seguidas se unen", () => {
    const b = parsearMarkdown("Uno\ndos.\n\nTres.");
    expect(b).toEqual([
      { tipo: "parrafo", hijos: [{ tipo: "texto", texto: "Uno dos." }] },
      { tipo: "parrafo", hijos: [{ tipo: "texto", texto: "Tres." }] },
    ]);
  });

  it("listas con guion, asterisco y numeradas", () => {
    const b = parsearMarkdown("- a\n- b\n\n1. x\n2) y\n* z");
    expect(b.map((x) => x.tipo)).toEqual(["lista", "lista", "lista"]);
    expect(b[0]).toMatchObject({ ordenada: false, items: [[{ tipo: "texto", texto: "a" }], [{ tipo: "texto", texto: "b" }]] });
    expect(b[1]).toMatchObject({ ordenada: true });
    expect((b[1] as { items: unknown[] }).items).toHaveLength(2);
    expect(b[2]).toMatchObject({ ordenada: false });
  });

  it("negrita, cursiva y código en línea; código no se interpreta", () => {
    expect(parsearInline("A **b** y *c* con `**no**`")).toEqual([
      { tipo: "texto", texto: "A " },
      { tipo: "negrita", hijos: [{ tipo: "texto", texto: "b" }] },
      { tipo: "texto", texto: " y " },
      { tipo: "cursiva", hijos: [{ tipo: "texto", texto: "c" }] },
      { tipo: "texto", texto: " con " },
      { tipo: "codigo", texto: "**no**" },
    ]);
    expect(inlineATexto(parsearInline("**x** `y` _z_"))).toBe("x y z");
  });

  it("cabeceras y bloques de código", () => {
    const b = parsearMarkdown("## Título\n```\ncode\n```\nfin");
    expect(b[0]).toEqual({ tipo: "cabecera", nivel: 2, hijos: [{ tipo: "texto", texto: "Título" }] });
    expect(b[1]).toEqual({ tipo: "codigo", texto: "code" });
    expect(b[2]).toMatchObject({ tipo: "parrafo" });
  });

  it("texto vacío → sin bloques; asteriscos sueltos no rompen", () => {
    expect(parsearMarkdown("")).toEqual([]);
    expect(parsearInline("2 * 3 * 4")).toEqual([{ tipo: "texto", texto: "2 * 3 * 4" }]);
  });
});
