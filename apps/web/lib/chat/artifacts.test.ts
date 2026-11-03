import { describe, expect, it } from "vitest";
import { extraerArtefactos, parsearArtefacto, ParserArtefactos } from "./artifacts";

const BLOQUE = '```artifact:entradas\n{"titulo": "Agosto", "ids": ["a1b2c3d4e5f60718", "ffffffffffffffff"]}\n```';

function alimentar(trozos: string[]) {
  const p = new ParserArtefactos();
  let texto = "";
  const artefactos = [];
  for (const t of trozos) {
    const s = p.push(t);
    texto += s.texto;
    artefactos.push(...s.artefactos);
  }
  const f = p.fin();
  texto += f.texto;
  artefactos.push(...f.artefactos);
  return { texto, artefactos };
}

describe("ParserArtefactos", () => {
  it("texto sin artefacto pasa íntegro", () => {
    const r = alimentar(["Hola ", "mundo.\n", "Fin."]);
    expect(r.texto).toBe("Hola mundo.\nFin.");
    expect(r.artefactos).toEqual([]);
  });

  it("extrae el bloque completo y lo oculta del texto", () => {
    const r = extraerArtefactos(`Resumen de agosto.\n\n${BLOQUE}\n`);
    expect(r.texto).toBe("Resumen de agosto.\n\n");
    expect(r.artefactos).toEqual([{ titulo: "Agosto", ids: ["a1b2c3d4e5f60718", "ffffffffffffffff"] }]);
  });

  it("funciona aunque el bloque llegue partido en deltas arbitrarios", () => {
    const completo = `Dos entradas.\n${BLOQUE}`;
    for (const tam of [1, 2, 3, 5, 7, 11]) {
      const trozos: string[] = [];
      for (let i = 0; i < completo.length; i += tam) trozos.push(completo.slice(i, i + tam));
      const r = alimentar(trozos);
      expect(r.texto, `tam ${tam}`).toBe("Dos entradas.\n");
      expect(r.artefactos, `tam ${tam}`).toHaveLength(1);
      expect(r.artefactos[0]!.ids).toEqual(["a1b2c3d4e5f60718", "ffffffffffffffff"]);
    }
  });

  it("retiene un posible inicio de fence y lo suelta si no era", () => {
    const p = new ParserArtefactos();
    const a = p.push("Código ``");
    expect(a.texto).toBe("Código ");
    const b = p.push("` no es artefacto");
    expect(b.texto).toBe("``` no es artefacto");
    expect(p.fin().texto).toBe("");
  });

  it("un bloque sin cerrar al terminar se parsea en fin()", () => {
    const p = new ParserArtefactos();
    p.push('Texto\n```artifact:entradas\n{"titulo":"T","ids":["x"]}');
    const f = p.fin();
    expect(f.artefactos).toEqual([{ titulo: "T", ids: ["x"] }]);
  });

  it("un bloque con JSON inválido vuelve como texto plano", () => {
    const r = extraerArtefactos("A\n```artifact:entradas\nno json\n```\nB");
    expect(r.artefactos).toEqual([]);
    expect(r.texto).toContain("no json");
    expect(r.texto).toContain("B");
  });

  it("tolera prefijo json, ids duplicados y título vacío", () => {
    expect(parsearArtefacto('json\n{"titulo":"","ids":["a","a"," b "]}')).toEqual({ titulo: "Entradas citadas", ids: ["a", "b"] });
    expect(parsearArtefacto('{"ids":"no"}')).toBeNull();
    expect(parsearArtefacto("[]")).toBeNull();
  });

  it("solo el primer bloque se considera si hay varios; ambos se extraen", () => {
    const r = extraerArtefactos(`${BLOQUE}\nmedio\n${BLOQUE}`);
    expect(r.artefactos).toHaveLength(2);
    expect(r.texto).toBe("medio\n");
  });
});
