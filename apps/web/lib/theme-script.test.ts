import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "./theme";

describe("THEME_INIT_SCRIPT", () => {
  it("es JavaScript válido y fija tema (oscuro por defecto) y sección", () => {
    const dataset: Record<string, string> = {};
    const g = {
      localStorage: { getItem: () => null },
      matchMedia: () => ({ matches: false }),
      document: { documentElement: { dataset }, cookie: "" },
      location: { pathname: "/corridas/abc" },
    };
    new Function("localStorage", "window", "document", "location", THEME_INIT_SCRIPT)(g.localStorage, g, g.document, g.location);
    expect(dataset.theme).toBe("dark");
    expect(dataset.section).toBe("corridas");
  });
});
