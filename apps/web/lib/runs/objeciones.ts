// Utilidades puras de objeciones: las usan tanto componentes de servidor (detalle de corrida)
// como de cliente (ConfirmDialog). No llevar "use client" aquí.

export interface ObjecionUi {
  marca: string;
  problema: string;
}

/** Agrupa objeciones por competidor conservando el orden de aparición. */
export function agruparObjeciones(objeciones: readonly ObjecionUi[]): { marca: string; problemas: string[] }[] {
  const grupos = new Map<string, string[]>();
  for (const o of objeciones) {
    const lista = grupos.get(o.marca);
    if (lista) lista.push(o.problema);
    else grupos.set(o.marca, [o.problema]);
  }
  return [...grupos].map(([marca, problemas]) => ({ marca, problemas }));
}
