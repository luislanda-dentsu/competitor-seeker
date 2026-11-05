import { describe, expect, it } from "vitest";
import { seccionDe } from "./section";

describe("seccionDe", () => {
  it("asigna la sección por prefijo de ruta", () => {
    expect(seccionDe("/")).toBe("general");
    expect(seccionDe("/ajustes")).toBe("general");
    expect(seccionDe("/competidores")).toBe("competidores");
    expect(seccionDe("/competidores/interval")).toBe("competidores");
    expect(seccionDe("/corridas/abc")).toBe("corridas");
    expect(seccionDe("/asistente")).toBe("asistente");
  });
});
