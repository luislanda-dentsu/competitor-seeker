import { describe, expect, it } from "vitest";
import { decisionParaHistorica } from "@/lib/runs/apify";

describe("decisionParaHistorica", () => {
  it("una histórica confirmada no la bloquea el presupuesto diario ni el semanal", () => {
    for (const motivo of ["presupuesto diario agotado (140.6%)", "presupuesto semanal agotado (101%)"]) {
      const d = decisionParaHistorica({ habilitado: false, resultsLimit: 12, motivo });
      expect(d.habilitado).toBe(true);
      expect(d.motivo).toContain(motivo);
    }
  });

  it("respeta los demás bloqueos (token, config, mensual)", () => {
    for (const motivo of ["sin token", "deshabilitado en config", "uso mensual 92% ≥ 90%", "desactivado por la usuaria"]) {
      expect(decisionParaHistorica({ habilitado: false, resultsLimit: 12, motivo }).habilitado).toBe(false);
    }
  });

  it("no toca una decisión habilitada", () => {
    const d = { habilitado: true, resultsLimit: 12 };
    expect(decisionParaHistorica(d)).toBe(d);
  });
});
