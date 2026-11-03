import type { Corrida, Entrada } from "@competitor-seeker/core";
import { describe, expect, it } from "vitest";
import {
  agruparPorCorrida,
  contarEntradasSinCorrida,
  contarSenales,
  enlacesEvidencia,
  evolucionPorCorrida,
  filtrarEntradas,
  filtrarGrupos,
  ordenarPorFechaDesc,
  pctConEvidencia,
  resolverSlugsCompetidores,
  serieDesdeGrupos,
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

describe("serieDesdeGrupos (Home coherente con el log)", () => {
  it("incluye corridas sin archivo (fecha = max de sus entradas) y no registradas", () => {
    const pendiente = corrida("c3", "2026-10-01", { estado: "pendiente-confirmacion", verificado: false });
    const entradas = [...E, entrada({ fecha: "2026-10-01", senal: "nuevo", corrida: "c3" })];
    const grupos = agruparPorCorrida(entradas, [...C, pendiente]);
    const serie = serieDesdeGrupos(grupos);
    expect(serie.map((p) => p.corridaId)).toEqual(["huerfana", "c1", "c2", "c3"]);
    expect(serie[0]).toEqual({ corridaId: "huerfana", fecha: "2026-06-01", nuevo: 0, confuso: 0, sinDatos: 1, noFunciona: 0 });
    expect(serie[1]).toMatchObject({ fecha: "2026-08-20", nuevo: 1, confuso: 1, sinDatos: 1, noFunciona: 0 });
    expect(serie[3]).toMatchObject({ corridaId: "c3", nuevo: 1 });
    // Toda entrada del log cuenta en algún punto.
    const total = serie.reduce((acc, p) => acc + p.nuevo + p.confuso + p.sinDatos + p.noFunciona, 0);
    expect(total).toBe(entradas.length);
    expect(contarEntradasSinCorrida(grupos)).toBe(1);
  });

  it("sin entradas devuelve serie vacía y cero sin corrida", () => {
    expect(serieDesdeGrupos([])).toEqual([]);
    expect(contarEntradasSinCorrida([])).toBe(0);
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

describe("resolverSlugsCompetidores (colisiones de slug)", () => {
  const lista = [
    { slug: "coca-cola-rd", nombre: "Coca Cola RD", activo: true },
    { slug: "country-club-rd", nombre: "Country Club RD", activo: true },
  ];

  it("dos nombres distintos que slugifican igual reciben slugs únicos y deterministas", () => {
    const r = resolverSlugsCompetidores(lista, ["Coca-Cola RD", "Coca Cola RD", "Coca-Cola RD"]);
    expect(r).toEqual([
      { nombre: "Coca Cola RD", slug: "coca-cola-rd", enLista: true },
      { nombre: "Country Club RD", slug: "country-club-rd", enLista: true },
      { nombre: "Coca-Cola RD", slug: "coca-cola-rd-2", enLista: false },
    ]);
    const slugs = r.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    // Cada slug resuelve a un nombre exacto.
    expect(r.find((c) => c.slug === "coca-cola-rd-2")?.nombre).toBe("Coca-Cola RD");
  });

  it("los de marca.json van primero en su orden; los solo-log después, alfabéticamente", () => {
    const r = resolverSlugsCompetidores(lista, ["Zeta", "Alfa", "Coca Cola RD"]);
    expect(r.map((c) => c.nombre)).toEqual(["Coca Cola RD", "Country Club RD", "Alfa", "Zeta"]);
    expect(r.map((c) => c.slug)).toEqual(["coca-cola-rd", "country-club-rd", "alfa", "zeta"]);
  });

  it("tres colisiones → -2, -3; un inactivo sin entradas reserva su slug pero no es visible", () => {
    const conInactivo = [...lista, { slug: "pepsi", nombre: "Pepsi RD", activo: false }];
    const r = resolverSlugsCompetidores(conInactivo, ["Coca-Cola RD", "Coca_Cola RD", "Pepsi"]);
    expect(r.map((c) => [c.nombre, c.slug])).toEqual([
      ["Coca Cola RD", "coca-cola-rd"],
      ["Country Club RD", "country-club-rd"],
      ["Coca-Cola RD", "coca-cola-rd-2"],
      ["Coca_Cola RD", "coca-cola-rd-3"],
      ["Pepsi", "pepsi-2"],
    ]);
  });

  it("un inactivo con entradas en el log sí es visible, con su slug de la lista", () => {
    const conInactivo = [...lista, { slug: "pepsi", nombre: "Pepsi RD", activo: false }];
    const r = resolverSlugsCompetidores(conInactivo, ["Pepsi RD"]);
    expect(r.at(-1)).toEqual({ nombre: "Pepsi RD", slug: "pepsi", enLista: true });
  });
});
