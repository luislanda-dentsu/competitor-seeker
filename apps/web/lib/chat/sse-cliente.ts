/**
 * Lectura de `text/event-stream` desde `fetch` (POST): el navegador no ofrece
 * EventSource para POST, así que parseamos las tramas a mano.
 * `parsearTramasSSE` es pura (testeada); `leerSSE` la aplica a un ReadableStream.
 */

export interface TramaSSE {
  evento: string;
  datos: string;
  id?: string;
}

export interface ResultadoTramas {
  tramas: TramaSSE[];
  /** Fragmento incompleto que espera más bytes. */
  resto: string;
}

/** Separa tramas completas (terminadas en línea en blanco) y las parsea. */
export function parsearTramasSSE(buffer: string): ResultadoTramas {
  const normalizado = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const partes = normalizado.split("\n\n");
  const resto = partes.pop() ?? "";
  const tramas: TramaSSE[] = [];
  for (const parte of partes) {
    let evento = "message";
    let id: string | undefined;
    const datos: string[] = [];
    for (const linea of parte.split("\n")) {
      if (linea === "" || linea.startsWith(":")) continue;
      const sep = linea.indexOf(":");
      const campo = sep < 0 ? linea : linea.slice(0, sep);
      let valor = sep < 0 ? "" : linea.slice(sep + 1);
      if (valor.startsWith(" ")) valor = valor.slice(1);
      if (campo === "event") evento = valor;
      else if (campo === "data") datos.push(valor);
      else if (campo === "id") id = valor;
    }
    if (datos.length === 0) continue;
    tramas.push({ evento, datos: datos.join("\n"), ...(id !== undefined ? { id } : {}) });
  }
  return { tramas, resto };
}

/** Itera las tramas de un cuerpo de respuesta. Termina al cerrarse el stream. */
export async function* leerSSE(cuerpo: ReadableStream<Uint8Array>): AsyncGenerator<TramaSSE> {
  const lector = cuerpo.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const r = parsearTramasSSE(buffer);
      buffer = r.resto;
      for (const t of r.tramas) yield t;
    }
    buffer += dec.decode();
    if (buffer.trim() !== "") {
      const r = parsearTramasSSE(buffer + "\n\n");
      for (const t of r.tramas) yield t;
    }
  } finally {
    lector.releaseLock();
  }
}
