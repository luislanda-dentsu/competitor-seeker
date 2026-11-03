// Integración sobre un repo temporal (CS_REPO_ROOT): el conjunto de slugs
// del proxy coincide con el de la Home/ficha, la caché se invalida por
// mtime, el proxy nunca lanza con slugs malformados y la Home es coherente
// con corridas sin archivo o no registradas.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proxy } from "../../proxy";
import { cargarCompetidor } from "./competidor";
import { cargarDatosMarca } from "./marca";
import { olvidarSlugsCacheados, resolverMarcaActiva, slugsDeCompetidores } from "./slugs";

let raiz: string;
const MARCA = "k";

function linea(marca: string, fecha: string, corrida: string, n: number, senal = "nuevo"): string {
  return JSON.stringify({
    id: String(n).padStart(16, "0"),
    marca,
    fecha,
    movimiento: `Movimiento ${n}`,
    senal,
    lectura: `Lectura ${n}`,
    corrida,
  });
}

function corrida(id: string, fecha: string, estado: string): string {
  return JSON.stringify({
    id,
    marca: MARCA,
    fecha,
    ultimaCorrida: null,
    inicio: `${fecha}T10:00:00.000Z`,
    estado,
    verificado: estado === "registrada",
    intentos: 1,
    modo: "ui",
    maquina: "test",
  });
}

function escribirLog(lineas: string[]): void {
  fs.writeFileSync(path.join(raiz, "marcas", MARCA, "log.jsonl"), lineas.join("\n") + "\n");
}

beforeEach(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), "cs-web-"));
  fs.writeFileSync(path.join(raiz, "CLAUDE.md"), "");
  const carpeta = path.join(raiz, "marcas", MARCA);
  fs.mkdirSync(path.join(carpeta, "corridas"), { recursive: true });
  fs.writeFileSync(
    path.join(carpeta, "marca.json"),
    JSON.stringify({
      slug: MARCA,
      nombre: "Marca K",
      creadaEn: "2026-01-01T00:00:00.000Z",
      competidores: [
        { slug: "coca-cola-rd", nombre: "Coca Cola RD", activo: true },
        { slug: "country-club-rd", nombre: "Country Club RD", activo: true },
      ],
    }),
  );
  fs.writeFileSync(path.join(carpeta, "corridas", "c1.json"), corrida("c1", "2026-08-20", "registrada"));
  fs.writeFileSync(path.join(carpeta, "corridas", "c2.json"), corrida("c2", "2026-09-10", "pendiente-confirmacion"));
  escribirLog([
    linea("Coca Cola RD", "2026-08-20", "c1", 1),
    linea("Coca-Cola RD", "2026-08-20", "c1", 2, "confuso"),
    linea("Country Club RD", "2026-09-10", "c2", 3),
    linea("Coca Cola RD", "2026-06-01", "sin-archivo", 4, "sin-datos"),
    linea("Coca-Cola RD", "2026-06-15", "sin-archivo", 5, "sin-datos"),
  ]);
  process.env.CS_REPO_ROOT = raiz;
  olvidarSlugsCacheados();
});

afterEach(() => {
  delete process.env.CS_REPO_ROOT;
  olvidarSlugsCacheados();
  fs.rmSync(raiz, { recursive: true, force: true });
});

function peticion(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

function reescritura(res: Response): string | null {
  return res.headers.get("x-middleware-rewrite");
}

describe("colisión de slugs (hallazgo 2)", () => {
  it("la Home expone slugs únicos y la ficha resuelve cada slug a su nombre exacto", () => {
    const datos = cargarDatosMarca(MARCA);
    expect(datos.competidores.map((c) => [c.nombre, c.slug, c.total])).toEqual([
      ["Coca Cola RD", "coca-cola-rd", 2],
      ["Country Club RD", "country-club-rd", 1],
      ["Coca-Cola RD", "coca-cola-rd-2", 2],
    ]);
    const ficha = cargarCompetidor(MARCA, "coca-cola-rd-2");
    expect(ficha?.competidor.nombre).toBe("Coca-Cola RD");
    expect(ficha?.entradas.map((e) => e.marca)).toEqual(["Coca-Cola RD", "Coca-Cola RD"]);
    expect(cargarCompetidor(MARCA, "coca-cola-rd")?.entradas.map((e) => e.id)).toEqual([
      "0000000000000001",
      "0000000000000004",
    ]);
  });

  it("slugsDeCompetidores (proxy) devuelve exactamente el conjunto de la Home", () => {
    const home = new Set(cargarDatosMarca(MARCA).competidores.map((c) => c.slug));
    expect(slugsDeCompetidores(MARCA)).toEqual(home);
    expect(home.has("coca-cola-rd-2")).toBe(true);
  });
});

describe("proxy (hallazgos 1 y 4)", () => {
  it("un slug con porcentaje malformado no lanza: reescribe al 404", () => {
    expect(resolverMarcaActiva(undefined)).toBe(MARCA);
    let res: Response | undefined;
    expect(() => {
      res = proxy(peticion("/competidores/%E0%A4%A"));
    }).not.toThrow();
    expect(reescritura(res!)).toContain("/competidores/_/no-encontrado");
  });

  it("deja pasar slugs conocidos (incluido el desambiguado) y reescribe los desconocidos", () => {
    expect(reescritura(proxy(peticion("/competidores/coca-cola-rd")))).toBeNull();
    expect(reescritura(proxy(peticion("/competidores/coca-cola-rd-2")))).toBeNull();
    expect(reescritura(proxy(peticion("/competidores/coca-cola-rd-3")))).toContain("/no-encontrado");
    expect(reescritura(proxy(peticion("/competidores/no-existe")))).toContain("/no-encontrado");
  });

  it("la caché se invalida cuando cambia log.jsonl o marca.json", () => {
    const antes = slugsDeCompetidores(MARCA);
    expect(antes.has("pepsi-rd")).toBe(false);
    expect(slugsDeCompetidores(MARCA)).toBe(antes); // misma instancia: cacheado
    fs.appendFileSync(path.join(raiz, "marcas", MARCA, "log.jsonl"), linea("Pepsi RD", "2026-09-11", "c2", 6) + "\n");
    const despues = slugsDeCompetidores(MARCA);
    expect(despues).not.toBe(antes);
    expect(despues.has("pepsi-rd")).toBe(true);
    expect(reescritura(proxy(peticion("/competidores/pepsi-rd")))).toBeNull();

    const marcaJson = path.join(raiz, "marcas", MARCA, "marca.json");
    const marca = JSON.parse(fs.readFileSync(marcaJson, "utf8"));
    marca.competidores.push({ slug: "fanta", nombre: "Fanta RD", activo: true });
    fs.writeFileSync(marcaJson, JSON.stringify(marca));
    expect(slugsDeCompetidores(MARCA).has("fanta")).toBe(true);
  });

  it("si marca.json se rompe, slugsDeCompetidores lanza (el proxy deja pasar a error.tsx) y no sirve la caché", () => {
    expect(slugsDeCompetidores(MARCA).size).toBe(3);
    fs.writeFileSync(path.join(raiz, "marcas", MARCA, "marca.json"), "{ esto no es json");
    expect(() => slugsDeCompetidores(MARCA)).toThrow(/marca\.json|No se pudo leer/);
    // Sin marca.json válido tampoco hay marca activa: el proxy responde 404, nunca 500.
    expect(resolverMarcaActiva(undefined)).toBeNull();
    expect(reescritura(proxy(peticion("/competidores/coca-cola-rd")))).toContain("/no-encontrado");
  });
});

describe("Home coherente con el log (hallazgo 5)", () => {
  it("la serie incluye corridas no registradas y sin archivo; la última corrida sigue siendo la registrada", () => {
    const datos = cargarDatosMarca(MARCA);
    expect(datos.serie.map((p) => [p.corridaId, p.fecha])).toEqual([
      ["sin-archivo", "2026-06-15"],
      ["c1", "2026-08-20"],
      ["c2", "2026-09-10"],
    ]);
    expect(datos.serie[0]).toMatchObject({ sinDatos: 2, nuevo: 0 });
    expect(datos.serie[1]).toMatchObject({ nuevo: 1, confuso: 1 });
    expect(datos.serie[2]).toMatchObject({ nuevo: 1 });
    expect(datos.entradasSinCorrida).toBe(2);
    expect(datos.kpis.ultimaCorrida?.id).toBe("c1");
  });
});
