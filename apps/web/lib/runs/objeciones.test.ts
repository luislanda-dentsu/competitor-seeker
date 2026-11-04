import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { agruparObjeciones } from "./objeciones";

describe("agruparObjeciones", () => {
  it("agrupa por competidor en orden de aparición", () => {
    expect(
      agruparObjeciones([
        { marca: "A", problema: "1" },
        { marca: "B", problema: "2" },
        { marca: "A", problema: "3" },
      ]),
    ).toEqual([
      { marca: "A", problemas: ["1", "3"] },
      { marca: "B", problemas: ["2"] },
    ]);
  });

  it("vive en un módulo sin 'use client' (la usa la página de detalle, que es de servidor)", () => {
    const fuente = fs.readFileSync(path.join(import.meta.dirname, "objeciones.ts"), "utf8");
    expect(fuente).not.toMatch(/^["']use client["']/m);
  });
});
