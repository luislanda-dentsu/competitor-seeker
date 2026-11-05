import { describe, expect, it } from "vitest";
import { promptTurnoSiguiente } from "./prompt-turno";

describe("promptTurnoSiguiente", () => {
  it("lleva la fecha de hoy y la del contexto", () => {
    const p = promptTurnoSiguiente({ mensaje: "¿Qué hizo A?", hoy: "2026-11-05", contextoDel: "2026-11-01", ultimaCorrida: "2026-11-01" });
    expect(p).toBe("[Hoy es 2026-11-05. Tu contexto de log y corridas es del 2026-11-01.]\nPregunta de la usuaria: ¿Qué hizo A?");
  });

  it("avisa si hay una corrida posterior al contexto", () => {
    const p = promptTurnoSiguiente({ mensaje: "x", hoy: "2026-11-05", contextoDel: "2026-11-01", ultimaCorrida: "2026-11-04" });
    expect(p).toContain("corrida registrada el 2026-11-04, posterior a tu contexto");
  });

  it("sin corridas o con corrida del mismo día: no avisa", () => {
    for (const ultimaCorrida of [null, "2026-11-01", "2026-10-20"]) {
      const p = promptTurnoSiguiente({ mensaje: "x", hoy: "2026-11-05", contextoDel: "2026-11-01", ultimaCorrida });
      expect(p).not.toContain("posterior a tu contexto");
    }
  });

  it("nunca empieza por '-' aunque el mensaje sea un flag", () => {
    const p = promptTurnoSiguiente({ mensaje: "--chrome", hoy: "2026-11-05", contextoDel: "2026-11-05", ultimaCorrida: null });
    expect(p.startsWith("-")).toBe(false);
    expect(p.endsWith("Pregunta de la usuaria: --chrome")).toBe(true);
  });
});
