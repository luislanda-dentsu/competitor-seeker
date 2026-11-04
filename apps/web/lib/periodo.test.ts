import { describe, expect, it } from "vitest";
import { resolverPeriodo } from "./periodo";

const HOY = "2026-11-04";

describe("resolverPeriodo", () => {
  it("por defecto: últimos 30 días inclusive", () => {
    expect(resolverPeriodo({}, HOY)).toMatchObject({ clave: "30d", desde: "2026-10-06", hasta: HOY, query: "p=30d" });
  });

  it("presets y todo el histórico", () => {
    expect(resolverPeriodo({ p: "7d" }, HOY)).toMatchObject({ desde: "2026-10-29", hasta: HOY });
    expect(resolverPeriodo({ p: "todo" }, HOY)).toMatchObject({ desde: null, hasta: null });
  });

  it("personalizado válido; inválido o invertido cae al defecto", () => {
    expect(resolverPeriodo({ p: "custom", desde: "2026-10-01", hasta: "2026-10-15" }, HOY)).toMatchObject({
      clave: "custom",
      desde: "2026-10-01",
      hasta: "2026-10-15",
      etiqueta: "01/10/2026 – 15/10/2026",
    });
    expect(resolverPeriodo({ p: "custom", desde: "2026-10-15", hasta: "2026-10-01" }, HOY).clave).toBe("30d");
    expect(resolverPeriodo({ p: "custom", desde: "ayer" }, HOY).clave).toBe("30d");
    expect(resolverPeriodo({ p: "x" }, HOY).clave).toBe("30d");
  });

  it("sin ?p usa la cookie; la URL manda sobre la cookie", () => {
    expect(resolverPeriodo({}, HOY, "p=90d").clave).toBe("90d");
    expect(resolverPeriodo({ p: "7d" }, HOY, "p=90d").clave).toBe("7d");
  });
});
