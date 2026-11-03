import { describe, expect, it } from "vitest";
import type { EventoCorrida } from "@competitor-seeker/core";
import { cerrarConsola, estadoInicial, prefijoDeEtiqueta, reducirConsola, reducirTodo } from "./consola";

const fase = (f: string, etiqueta: string): EventoCorrida => ({ ts: 1, tipo: "fase", fase: f, etiqueta, texto: `${f}: ${etiqueta}` });
const texto = (t: string): EventoCorrida => ({ ts: 1, tipo: "texto", texto: t });

describe("consola", () => {
  it("prefijos: rastreo-ig / rastreo-web / analista:N / verificador:N", () => {
    expect(prefijoDeEtiqueta("rastreo-ig:todos", "Rastreo")).toEqual({ prefijo: "[rastreo-ig]", texto: "todos los perfiles" });
    expect(prefijoDeEtiqueta("rastreo-web:Country Club RD", "Rastreo")).toEqual({ prefijo: "[rastreo-web]", texto: "Country Club RD" });
    expect(prefijoDeEtiqueta("analista:intento-2", "Análisis")).toEqual({ prefijo: "[analista:2]", texto: "intento 2" });
    expect(prefijoDeEtiqueta("verificacion:intento-3", "Verificación")).toEqual({ prefijo: "[verificador:3]", texto: "intento 3" });
    expect(prefijoDeEtiqueta(undefined, "Rastreo")).toEqual({ prefijo: "[rastreo]", texto: "Rastreo" });
  });

  it("funde los deltas del orquestador en una línea y avanza las fases", () => {
    let e = estadoInicial();
    e = reducirConsola(e, texto("Lanzo "));
    e = reducirConsola(e, texto("el workflow"));
    expect(e.lineas).toHaveLength(1);
    expect(e.lineas[0]?.texto).toBe("Lanzo el workflow");
    expect(e.ultimoTexto).toBe("Lanzo el workflow");
    e = reducirConsola(e, fase("Rastreo", "rastreo-ig:todos"));
    expect(e.fases).toEqual({ Rastreo: "activo", Análisis: "pendiente", Verificación: "pendiente" });
    e = reducirConsola(e, fase("Verificación", "verificacion:intento-2"));
    expect(e.fases).toEqual({ Rastreo: "ok", Análisis: "ok", Verificación: "activo" });
    expect(e.intentosVerificacion).toBe(2);
    expect(e.lineas.map((l) => l.prefijo)).toEqual(["[orquestador]", "[rastreo-ig]", "[verificador:2]"]);
  });

  it("cerrarConsola marca ok o error según el estado final", () => {
    const base = reducirTodo([fase("Rastreo", "rastreo-ig:todos"), fase("Análisis", "analista:intento-1")]);
    expect(cerrarConsola(base, { estado: "registrada", intentos: 1 }).fases).toEqual({ Rastreo: "ok", Análisis: "ok", Verificación: "ok" });
    const err = cerrarConsola(base, { estado: "error", error: "cancelada" });
    expect(err.fases).toEqual({ Rastreo: "ok", Análisis: "error", Verificación: "pendiente" });
    expect(err.fin?.error).toBe("cancelada");
    expect(reducirTodo([], { estado: "pendiente-confirmacion", intentos: 3 }).intentosVerificacion).toBe(3);
  });
});
