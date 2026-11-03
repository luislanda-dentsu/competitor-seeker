import type { Corrida, Entrada } from "@competitor-seeker/core";
import { describe, expect, it } from "vitest";
import {
  agruparPorCorrida,
  contarSenales,
  enlacesEvidencia,
  evolucionPorCorrida,
  filtrarEntradas,
  filtrarGrupos,
  ordenarPorFechaDesc,
  pctConEvidencia,
  slugDeCompetidor,
  slugify,
} from "./agrupar";

let n = 0;
function entrada(parcial: Partial<Entrada> & Pick<Entrada, "fecha" | "senal" | "corrida">): Entrada {
  n += 1;
  return {
    id: String(n).padStart(16, "0"),
    marca: "Coca Cola RD",
    movimiento: `Movimiento ${n}`,
    lectura: `Lectura ${n}`,
    ...parcial,
  };
}

function corrida(id: string, fecha: string, extra: Partial<Corrida> = {}): Corrida {
  return {
    id,
    marca: "kolareal",
    fecha,
    ultimaCorrida: null,
    inicio: `${fecha}T10:00:00.000Z`,
    estado: "registrada",
    verificado: true,
    intentos: 1,
    objeciones: [],
    fuentes: [],
    competidores: [],
    entradas: [],
    modo: "ui",
    maquina: "test",
    ...extra,
  };
}

const E = [
  entrada({ fecha: "2026-07-08", senal: "nuevo", corrida: "c1", movimiento: "Patrocinio deportivo", evidencia: ["https://a.test/1"] }),
  entrada({ fecha: "2026-08-20", senal: "sin-datos", corrida: "c1" }),
  entrada({ fecha: "2026-08-20", senal: "confuso", corrida: "c1", lectura: "Promoción Mundial poco clara" }),
  entrada({ fecha: "2026-09-02", senal: "nuevo", corrida: "c2", movimiento: "Lanzó sabor Café" , evidencia: ["https://a.test/1", "https://a.test/2"] }),
  entrada({ fecha: "2026-09-01", senal: "no-funciona", corrida: "c2" }),
  entrada({ fecha: "2026-06-01", senal: "sin-datos", corrida: "huerfana" }),
];
const C = [corrida("c1", "2026-08-20", { modo: "migrada", intentos: 0 }), corrida("c2", "2026-09-02")];

describe("agruparPorCorrida", () => {
  it("agrupa por corrida, más reciente primero, y ordena entradas por fecha desc", () => {
    const g = agruparPorCorrida(E, C);
    expect(g.map((x) => x.corridaId)).toEqual(["c2", "c1", "huerfana"]);
    expect(g[0]!.entradas.map((e) => e.fecha)).toEqual(["2026-09-02", "2026-09-01"]);
    expect(g[1]!.entradas.map((e) => e.fecha)).toEqual(["2026-08-20", "2026-08-20", "2026-07-08"]);
  });

  it("conserva metadatos de la corrida y tolera corridas sin archivo", () => {
    const g = agruparPorCorrida(E, C);
    expect(g[1]!.corrida).toMatchObject({ id: "c1", modo: "migrada", intentos: 0, verificado: true });
    expect(g[2]!.corrida).toBeNull();
    expect(g[2]!.fecha).toBe("2026-06-01");
  });

  it("con empate de fecha de entradas el orden original es estable", () => {
    const [a, b] = agruparPorCorrida(E, C)[1]!.entradas;
    expect(a!.senal).toBe("sin-datos");
    expect(b!.senal).toBe("confuso");
  });
});

describe("filtrarEntradas / filtrarGrupos", () => {
  it("sin filtro devuelve todo", () => {
    expect(filtrarEntradas(E, {})).toHaveLength(E.length);
    expect(filtrarEntradas(E, { senales: [], texto: "  " })).toHaveLength(E.length);
  });

  it("filtra por una o varias señales", () => {
    expect(filtrarEntradas(E, { senales: ["nuevo"] })).toHaveLength(2);
    expect(filtrarEntradas(E, { senales: ["nuevo", "confuso"] })).toHaveLength(3);
  });

  it("busca en movimiento y lectura sin acentos ni mayúsculas", () => {
    expect(filtrarEntradas(E, { texto: "PROMOCION" })).toHaveLength(1);
    expect(filtrarEntradas(E, { texto: "cafe" }).map((e) => e.movimiento)).toEqual(["Lanzó sabor Café"]);
    expect(filtrarEntradas(E, { texto: "nada-que-ver" })).toHaveLength(0);
  });

  it("combina señal y texto y descarta grupos vacíos", () => {
    const g = filtrarGrupos(agruparPorCorrida(E, C), { senales: ["nuevo"], texto: "patrocinio" });
    expect(g).toHaveLength(1);
    expect(g[0]!.corridaId).toBe("c1");
    expect(g[0]!.entradas).toHaveLength(1);
  });
});

describe("evolución y conteos", () => {
  it("evolucionPorCorrida va en orden cronológico con señal por entrada", () => {
    const ev = evolucionPorCorrida(agruparPorCorrida(E, C));
    expect(ev.map((p) => p.corridaId)).toEqual(["huerfana", "c1", "c2"]);
    expect(ev[1]!.senales).toEqual(["sin-datos", "confuso", "nuevo"]);
    expect(ev[1]!.conteo).toEqual({ nuevo: 1, confuso: 1, "sin-datos": 1, "no-funciona": 0 });
    expect(ev[1]!.pctConEvidencia).toBeCloseTo(66.7, 1);
    expect(ev[2]!.pctConEvidencia).toBe(100);
  });

  it("contarSenales y pctConEvidencia", () => {
    expect(contarSenales(E)).toEqual({ nuevo: 2, confuso: 1, "sin-datos": 2, "no-funciona": 1 });
    expect(pctConEvidencia(E)).toBeCloseTo(66.7, 1);
    expect(pctConEvidencia([])).toBe(0);
  });

  it("ordenarPorFechaDesc no muta la entrada", () => {
    const copia = [...E];
    ordenarPorFechaDesc(E);
    expect(E).toEqual(copia);
  });
});

describe("evidencia y slugs", () => {
  it("enlacesEvidencia deduplica conservando el orden", () => {
    expect(enlacesEvidencia(E)).toEqual(["https://a.test/1", "https://a.test/2"]);
  });

  it("slugify y slugDeCompetidor", () => {
    expect(slugify("Coca Cola RD")).toBe("coca-cola-rd");
    expect(slugify("  Café Ñandú  ")).toBe("cafe-nandu");
    const lista = [{ slug: "ccrd", nombre: "Coca Cola RD" }];
    expect(slugDeCompetidor("Coca Cola RD", lista)).toBe("ccrd");
    expect(slugDeCompetidor("Country Club RD", lista)).toBe("country-club-rd");
  });
});
