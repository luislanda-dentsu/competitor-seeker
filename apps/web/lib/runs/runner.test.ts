import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adquirirLock, crearMarca, guardarCorrida, leerCorrida, leerLock, liberarLock, nuevoIdCorrida, type Corrida } from "@competitor-seeker/core";
import { crearRepoTemporal, type RepoTemporal } from "../../../../packages/core/test/helpers";
import { obtenerViva, vivas } from "./registro";
import { cancelarCorrida, estadoRunner, lanzarCorrida, podarStreams, reconciliarHuerfanas } from "./runner";
import { rutaFinStream, rutaStream, rutaStreamsMarca } from "./rutas";

let repo: RepoTemporal;
beforeEach(() => {
  process.env.CS_RUNNER = "mock";
  repo = crearRepoTemporal();
  crearMarca({ nombre: "Kolareal", competidores: [{ nombre: "Coca Cola RD", url: "https://www.instagram.com/cocacolard/" }] });
  crearMarca({ nombre: "ZZ Tmp", competidores: [{ nombre: "Otro", url: "https://example.com" }] });
});
afterEach(async () => {
  for (const v of vivas()) await cancelarCorrida(v.marca, v.corridaId).catch(() => null);
  delete process.env.CS_RUNNER;
  repo.limpiar();
});

function enCurso(marca: string, id: string, modo: Corrida["modo"] = "ui"): Corrida {
  return {
    id, marca, fecha: "2026-11-03", ultimaCorrida: null, inicio: new Date(Date.now() - 60_000).toISOString(), estado: "en-curso",
    verificado: false, intentos: 0, objeciones: [], fuentes: [], competidores: [], entradas: [], modo, maquina: "h",
  };
}

describe("runner (mock)", () => {
  it("dos marcas en el mismo minuto: ids y streams distintos, y el stream previo del id se borra", async () => {
    const esperado = nuevoIdCorrida("kolareal");
    // Restos de un intento anterior con el mismo id: no deben contaminar el stream nuevo.
    fs.mkdirSync(rutaStreamsMarca("kolareal"), { recursive: true });
    fs.writeFileSync(rutaStream("kolareal", esperado), '{"type":"cs_error","texto":"BASURA-PREVIA"}\n');
    fs.writeFileSync(rutaFinStream("kolareal", esperado), "viejo\n");

    const a = await lanzarCorrida({ marca: "kolareal", incluirApify: false });
    expect(a.corridaId).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}-kolareal-[a-z0-9-]+$/);
    expect(leerLock()?.corridaId).toBe(a.corridaId);
    // Mientras corre, la segunda marca choca con el lock global.
    await expect(lanzarCorrida({ marca: "zz-tmp", incluirApify: false })).rejects.toThrow(/en curso/);
    const ra = await cancelarCorrida("kolareal", a.corridaId);
    expect(ra?.via).toBe("proceso");
    expect(obtenerViva(a.corridaId)).toBeUndefined();
    expect(leerLock()).toBeNull();
    const ca = leerCorrida("kolareal", a.corridaId);
    expect(ca.estado).toBe("error");
    expect(ca.error).toBe("cancelada");
    expect(ca.fin).toBeDefined();
    if (a.corridaId === esperado) {
      expect(fs.readFileSync(rutaStream("kolareal", a.corridaId), "utf8")).not.toContain("BASURA-PREVIA");
      expect(fs.readFileSync(rutaFinStream("kolareal", a.corridaId), "utf8")).not.toBe("viejo\n");
    }

    const b = await lanzarCorrida({ marca: "zz-tmp", incluirApify: false });
    expect(b.corridaId).toMatch(/-zz-tmp-/);
    expect(b.corridaId).not.toBe(a.corridaId);
    expect(rutaStream("zz-tmp", b.corridaId)).not.toBe(rutaStream("kolareal", a.corridaId));
    await obtenerViva(b.corridaId)!.terminada;
    expect(fs.existsSync(rutaStream("zz-tmp", b.corridaId))).toBe(true);
    expect(fs.existsSync(rutaFinStream("zz-tmp", b.corridaId))).toBe(true);
    expect(fs.existsSync(rutaStream("kolareal", a.corridaId))).toBe(true);
    // El mock no registra vía `cs registrar`: la corrida cierra como error "sin registrar", con fin y duración.
    const cb = leerCorrida("zz-tmp", b.corridaId);
    expect(cb.estado).toBe("error");
    expect(cb.error).toMatch(/sin registrar/);
    expect(cb.sessionId).toBe("00000000-0000-4000-8000-000000000001");
    expect(leerLock()).toBeNull();
  }, 30_000);

  it("reconcilia corridas en-curso huérfanas (modo ui, sin proceso ni lock vivo) como error: servidor reiniciado", () => {
    guardarCorrida(enCurso("kolareal", "2026-11-03-0900-kolareal-mac"));
    guardarCorrida(enCurso("zz-tmp", "2026-11-03-0901-zz-tmp-mac"));
    guardarCorrida(enCurso("kolareal", "2026-11-03-0902-terminal", "terminal"));
    guardarCorrida(enCurso("kolareal", "2026-11-03-0903-kolareal-mac"));
    // Lock vivo (nuestro pid) para la última: no es huérfana.
    adquirirLock({ corridaId: "2026-11-03-0903-kolareal-mac", marca: "kolareal" });

    const estado = estadoRunner();
    expect(estado.reconciliadas.map((c) => c.corridaId).sort()).toEqual(["2026-11-03-0900-kolareal-mac", "2026-11-03-0901-zz-tmp-mac"]);
    expect(estado.enCurso?.corridaId).toBe("2026-11-03-0903-kolareal-mac");
    const r = leerCorrida("kolareal", "2026-11-03-0900-kolareal-mac");
    expect(r.estado).toBe("error");
    expect(r.error).toBe("servidor reiniciado");
    expect(r.fin).toBeDefined();
    expect(r.duracionMs).toBeGreaterThan(0);
    expect(leerCorrida("zz-tmp", "2026-11-03-0901-zz-tmp-mac").error).toBe("servidor reiniciado");
    expect(leerCorrida("kolareal", "2026-11-03-0902-terminal").estado).toBe("en-curso");
    expect(leerCorrida("kolareal", "2026-11-03-0903-kolareal-mac").estado).toBe("en-curso");
    // Idempotente.
    expect(reconciliarHuerfanas()).toEqual([]);
    liberarLock();

    // Lock huérfano (pid muerto) apuntando a una en-curso: se cierra y se libera el lock.
    // (0903 perdió su lock vivo al liberarlo arriba: ahora también es huérfana.)
    guardarCorrida(enCurso("kolareal", "2026-11-03-0904-kolareal-mac"));
    adquirirLock({ corridaId: "2026-11-03-0904-kolareal-mac", marca: "kolareal", pid: 2147483646 });
    expect(reconciliarHuerfanas().map((c) => c.corridaId).sort()).toEqual(["2026-11-03-0903-kolareal-mac", "2026-11-03-0904-kolareal-mac"]);
    expect(leerLock()).toBeNull();
    expect(leerCorrida("kolareal", "2026-11-03-0904-kolareal-mac").error).toBe("servidor reiniciado");
  });

  it("cancelarCorrida cierra una en-curso sin proceso y responde null si no hay nada que cancelar", async () => {
    guardarCorrida(enCurso("kolareal", "2026-11-03-0910-kolareal-mac"));
    const r = await cancelarCorrida("kolareal", "2026-11-03-0910-kolareal-mac");
    expect(r).toEqual({ corridaId: "2026-11-03-0910-kolareal-mac", via: "huerfana" });
    const c = leerCorrida("kolareal", "2026-11-03-0910-kolareal-mac");
    expect(c.estado).toBe("error");
    expect(c.error).toBe("cancelada");
    expect(c.fin).toBeDefined();
    expect(await cancelarCorrida("kolareal", "2026-11-03-0910-kolareal-mac")).toBeNull();
    expect(await cancelarCorrida("zz-tmp", "no-existe")).toBeNull();
    // Con la marca equivocada no se toca la corrida de otra marca.
    guardarCorrida(enCurso("zz-tmp", "2026-11-03-0911-zz-tmp-mac"));
    expect(await cancelarCorrida("kolareal", "2026-11-03-0911-zz-tmp-mac")).toBeNull();
    expect(leerCorrida("zz-tmp", "2026-11-03-0911-zz-tmp-mac").estado).toBe("en-curso");
  });

  it("podarStreams borra solo los streams con más de N días (namespaceados y planos) y las carpetas vacías", () => {
    const viejo = Date.now() - 20 * 24 * 60 * 60 * 1000;
    const dirK = rutaStreamsMarca("kolareal");
    const dirZ = rutaStreamsMarca("zz-tmp");
    fs.mkdirSync(dirK, { recursive: true });
    fs.mkdirSync(dirZ, { recursive: true });
    const raiz = path.dirname(dirK);
    const archivos = {
      viejoK: path.join(dirK, "a.stream.jsonl"),
      viejoKFin: path.join(dirK, "a.stream.jsonl.fin"),
      nuevoK: path.join(dirK, "b.stream.jsonl"),
      viejoZ: path.join(dirZ, "c.stream.jsonl"),
      planoViejo: path.join(raiz, "legacy.stream.jsonl"),
      otro: path.join(dirK, "notas.txt"),
    };
    for (const ruta of Object.values(archivos)) fs.writeFileSync(ruta, "x\n");
    for (const ruta of [archivos.viejoK, archivos.viejoKFin, archivos.viejoZ, archivos.planoViejo, archivos.otro]) fs.utimesSync(ruta, viejo / 1000, viejo / 1000);

    expect(podarStreams(14)).toBe(4);
    expect(fs.existsSync(archivos.viejoK)).toBe(false);
    expect(fs.existsSync(archivos.viejoKFin)).toBe(false);
    expect(fs.existsSync(archivos.planoViejo)).toBe(false);
    expect(fs.existsSync(archivos.nuevoK)).toBe(true);
    expect(fs.existsSync(archivos.otro)).toBe(true);
    expect(fs.existsSync(dirZ)).toBe(false);
    expect(podarStreams(14)).toBe(0);
  });
});
