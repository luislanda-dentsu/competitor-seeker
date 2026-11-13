import type { Corrida, Entrada } from "@competitor-seeker/core";
import { describe, expect, it } from "vitest";
import { construirInforme } from "./informe";

const entrada = (id: string, marca: string, fecha: string, corrida: string): Entrada => ({
  id: id.padStart(16, "0"),
  marca,
  fecha,
  corrida,
  movimiento: `Movimiento ${id}`,
  lectura: `Lectura ${id}`,
  senal: "nuevo",
});

const corrida = (id: string, fecha: string, extra: Partial<Corrida> = {}): Corrida => ({
  id,
  marca: "parval",
  fecha,
  ultimaCorrida: null,
  inicio: `${fecha}T10:00:00.000Z`,
  estado: "registrada",
  verificado: true,
  intentos: 1,
  objeciones: [],
  fuentes: [],
  modo: "ui",
  maquina: "mac",
  competidores: ["Excel", "CCI"],
  entradas: [],
  ...extra,
});

const VENTANA = { desde: "2025-11-01", hasta: "2025-12-31" };

describe("construirInforme", () => {
  const historica = corrida("h", "2026-11-13", { tipo: "historica", ventana: VENTANA });
  const normal = corrida("n", "2026-11-10");
  const entradas = [
    entrada("1", "Excel", "2025-11-18", "h"),
    entrada("2", "Excel", "2026-11-08", "n"),
    entrada("3", "CCI", "2025-12-02", "h"),
  ];
  const competidores = [{ slug: "excel", nombre: "Excel" }, { slug: "cci", nombre: "CCI" }];

  it("los movimientos de una histórica salen en el periodo de sus entradas, no en el de la corrida", () => {
    const inf = construirInforme({ slug: "parval", nombre: "Parval" }, competidores, entradas, [historica, normal], VENTANA, "2026-11-13");
    const excel = inf.competidores[0]!;
    expect(excel.movimientos.map((g) => g.corridaId)).toEqual(["h"]);
    expect(excel.movimientos[0]!.entradas.map((e) => e.fecha)).toEqual(["2025-11-18"]);
    expect(excel.conteo.nuevo).toBe(1);
    expect(excel.evolucion.map((p) => p.corridaId)).toEqual(["h"]);
    expect(inf.competidores[1]!.movimientos[0]!.entradas).toHaveLength(1);
  });

  it("un periodo reciente no trae los movimientos de 2025", () => {
    const inf = construirInforme({ slug: "parval", nombre: "Parval" }, competidores, entradas, [historica, normal], { desde: "2026-11-01", hasta: "2026-11-13" }, "2026-11-13");
    expect(inf.competidores[0]!.movimientos.flatMap((g) => g.entradas.map((e) => e.fecha))).toEqual(["2026-11-08"]);
    expect(inf.competidores[1]!.movimientos).toEqual([]);
  });
});
