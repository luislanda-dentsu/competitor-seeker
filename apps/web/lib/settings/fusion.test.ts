import { describe, expect, it } from "vitest";
import type { ConfigCompartida } from "@competitor-seeker/core";
import { fusionarConfig } from "./fusion";

const actual = { apify: { habilitado: true, resultsLimit: 5, presupuesto: { mensualUsd: 10, avisoPct: 80 } }, otro: 1 } as unknown as ConfigCompartida;

describe("fusionarConfig", () => {
  it("conserva claves de apify y de presupuesto no enviadas", () => {
    const r = fusionarConfig(actual, { apify: { resultsLimit: 9, presupuesto: { mensualUsd: 20 } } } as unknown as Partial<ConfigCompartida>) as { apify: unknown; otro: number };
    expect(r.apify).toEqual({ habilitado: true, resultsLimit: 9, presupuesto: { mensualUsd: 20, avisoPct: 80 } });
    expect(r.otro).toBe(1);
  });
  it("sin apify en el parcial deja la actual", () => {
    expect((fusionarConfig(actual, {}) as { apify: { resultsLimit: number } }).apify.resultsLimit).toBe(5);
  });
});
