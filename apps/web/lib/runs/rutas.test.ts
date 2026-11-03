import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearRepoTemporal, type RepoTemporal } from "../../../../packages/core/test/helpers";
import { esIdCorridaValido, esSlugMarcaValido, rutaFinStream, rutaStream, rutaStreamsMarca } from "./rutas";
import { rutaApiCorrida, rutaUiCorrida } from "./tipos";

let repo: RepoTemporal;
beforeEach(() => {
  repo = crearRepoTemporal();
});
afterEach(() => repo.limpiar());

describe("rutas de corridas", () => {
  it("el stream va namespaceado por marca: dos marcas con el mismo id no comparten archivo", () => {
    const a = rutaStream("kolareal", "2026-11-03-0905-kolareal-mac");
    const b = rutaStream("zz-tmp", "2026-11-03-0905-kolareal-mac");
    expect(a).not.toBe(b);
    expect(a).toBe(path.join(repo.raiz, "data", "corridas-vivas", "kolareal", "2026-11-03-0905-kolareal-mac.stream.jsonl"));
    expect(rutaFinStream("kolareal", "x")).toBe(`${rutaStream("kolareal", "x")}.fin`);
    expect(path.dirname(a)).toBe(rutaStreamsMarca("kolareal"));
  });

  it("valida slug de marca e id de corrida", () => {
    expect(esSlugMarcaValido("kolareal")).toBe(true);
    expect(esSlugMarcaValido("zz-tmp")).toBe(true);
    for (const s of ["", "Kola", "a/b", "..", "-x", "x-", "a b"]) expect(esSlugMarcaValido(s)).toBe(false);
    expect(esIdCorridaValido("2026-11-03-0905-kolareal-mac")).toBe(true);
    expect(esIdCorridaValido("../x")).toBe(false);
  });

  it("las rutas de UI y API llevan la marca y el id (escapados)", () => {
    expect(rutaUiCorrida("kolareal", "2026-11-03-0905-kolareal-mac")).toBe("/corridas/kolareal/2026-11-03-0905-kolareal-mac");
    expect(rutaApiCorrida("zz-tmp", "a b")).toBe("/api/corridas/zz-tmp/a%20b");
  });
});
