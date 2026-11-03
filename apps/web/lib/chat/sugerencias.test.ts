import { describe, expect, it } from "vitest";
import { sugerenciasDe } from "./sugerencias";

describe("sugerenciasDe", () => {
  it("sin entradas: resumen + 2 fijas", () => {
    const s = sugerenciasDe([]);
    expect(s.map((x) => x.id)).toEqual(["resumen", "comparar", "senales"]);
  });

  it("con no-funciona y sin-datos: las tres específicas", () => {
    const s = sugerenciasDe([
      { marca: "A", senal: "no-funciona", fecha: "2026-08-01" },
      { marca: "B", senal: "no-funciona", fecha: "2026-08-02" },
      { marca: "B", senal: "no-funciona", fecha: "2026-07-02" },
      { marca: "A", senal: "sin-datos", fecha: "2026-08-03" },
      { marca: "C", senal: "nuevo", fecha: "2026-08-03" },
    ]);
    expect(s.map((x) => x.id)).toEqual(["resumen", "no-funciona", "sin-datos"]);
    expect(s[1]!.texto).toBe("¿Por qué no funciona el contenido de B?");
    expect(s[1]!.motivo).toBe("2 entradas no-funciona");
    expect(s[2]!.motivo).toBe("1 entrada sin-datos");
  });

  it("solo sin-datos: resumen + sin-datos + 1 fija; nunca más de 3", () => {
    const s = sugerenciasDe([{ marca: "A", senal: "sin-datos", fecha: "2026-08-03" }]);
    expect(s.map((x) => x.id)).toEqual(["resumen", "sin-datos", "comparar"]);
    expect(s).toHaveLength(3);
  });
});
