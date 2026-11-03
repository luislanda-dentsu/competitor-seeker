/**
 * Markdown mínimo para las respuestas del asistente: párrafos, listas (con y
 * sin numerar), cabeceras, bloques de código y, en línea, **negrita**,
 * *cursiva* y `código`. Sin dependencias; devuelve una estructura que el
 * componente <Markdown/> pinta con elementos nativos (nunca HTML crudo).
 */

export type Inline =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrita"; hijos: Inline[] }
  | { tipo: "cursiva"; hijos: Inline[] }
  | { tipo: "codigo"; texto: string };

export type Bloque =
  | { tipo: "parrafo"; hijos: Inline[] }
  | { tipo: "cabecera"; nivel: 1 | 2 | 3; hijos: Inline[] }
  | { tipo: "lista"; ordenada: boolean; items: Inline[][] }
  | { tipo: "codigo"; texto: string };

const RE_ITEM = /^\s{0,3}(?:[-*•]|\d{1,3}[.)])\s+(.*)$/;
const RE_ORDENADO = /^\s{0,3}\d{1,3}[.)]\s+/;
const RE_CABECERA = /^\s{0,3}(#{1,3})\s+(.*?)\s*#*\s*$/;

/** Inline: `código` primero (no se interpreta dentro), luego **negrita** y *cursiva*. */
export function parsearInline(texto: string): Inline[] {
  const salida: Inline[] = [];
  let resto = texto;
  const empujarTexto = (t: string) => {
    if (t === "") return;
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.tipo === "texto") ultimo.texto += t;
    else salida.push({ tipo: "texto", texto: t });
  };
  while (resto !== "") {
    const m = /(`[^`\n]+`)|(\*\*[^*\n](?:[^*\n]|\*(?!\*))*?\*\*)|(\*[^*\s][^*\n]*?\*)|(__[^_\n]+?__)|(\b_[^_\n]+?_\b)/.exec(resto);
    if (!m) {
      empujarTexto(resto);
      break;
    }
    empujarTexto(resto.slice(0, m.index));
    const tok = m[0];
    if (m[1]) salida.push({ tipo: "codigo", texto: tok.slice(1, -1) });
    else if (m[2] || m[4]) salida.push({ tipo: "negrita", hijos: parsearInline(tok.slice(2, -2)) });
    else salida.push({ tipo: "cursiva", hijos: parsearInline(tok.slice(1, -1)) });
    resto = resto.slice(m.index + tok.length);
  }
  return salida;
}

export function parsearMarkdown(texto: string): Bloque[] {
  const lineas = texto.replace(/\r\n?/g, "\n").split("\n");
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];
  let lista: { ordenada: boolean; items: string[] } | null = null;

  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: "parrafo", hijos: parsearInline(parrafo.join(" ").trim()) });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) bloques.push({ tipo: "lista", ordenada: lista.ordenada, items: lista.items.map((i) => parsearInline(i.trim())) });
    lista = null;
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!;
    if (/^\s{0,3}```/.test(linea)) {
      cerrarParrafo();
      cerrarLista();
      const cuerpo: string[] = [];
      i++;
      while (i < lineas.length && !/^\s{0,3}```/.test(lineas[i]!)) {
        cuerpo.push(lineas[i]!);
        i++;
      }
      bloques.push({ tipo: "codigo", texto: cuerpo.join("\n") });
      continue;
    }
    if (linea.trim() === "") {
      cerrarParrafo();
      cerrarLista();
      continue;
    }
    const cab = RE_CABECERA.exec(linea);
    if (cab) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: "cabecera", nivel: Math.min(3, cab[1]!.length) as 1 | 2 | 3, hijos: parsearInline(cab[2]!) });
      continue;
    }
    const item = RE_ITEM.exec(linea);
    if (item) {
      cerrarParrafo();
      const ordenada = RE_ORDENADO.test(linea);
      if (!lista || lista.ordenada !== ordenada) {
        cerrarLista();
        lista = { ordenada, items: [] };
      }
      lista.items.push(item[1]!);
      continue;
    }
    if (lista && /^\s{2,}/.test(linea)) {
      // Continuación del último ítem (línea indentada).
      lista.items[lista.items.length - 1] += " " + linea.trim();
      continue;
    }
    cerrarLista();
    parrafo.push(linea.trim());
  }
  cerrarParrafo();
  cerrarLista();
  return bloques;
}

/** Texto plano (sin marcas) de una lista de inlines. */
export function inlineATexto(inlines: readonly Inline[]): string {
  return inlines.map((i) => (i.tipo === "texto" || i.tipo === "codigo" ? i.texto : inlineATexto(i.hijos))).join("");
}
