// Prompt de los turnos con `--resume`: el contexto (log + corridas) solo viaja en el
// primer turno, así que en chats largos el asistente no sabe qué día es ni si su
// contexto quedó viejo. Cada turno siguiente lleva esa referencia temporal.

export interface DatosTurnoSiguiente {
  /** Mensaje de la usuaria tal cual. */
  mensaje: string;
  /** Fecha local de hoy (AAAA-MM-DD). */
  hoy: string;
  /** Fecha local (AAAA-MM-DD) en que se armó el contexto del chat. */
  contextoDel: string;
  /** Fecha de la última corrida registrada de la marca, o null. */
  ultimaCorrida: string | null;
}

/**
 * Texto del turno siguiente. Empieza por `[` (nunca por `-`): el texto va como
 * argumento del CLI y un mensaje como "--chrome" no debe leerse como flag.
 */
export function promptTurnoSiguiente(d: DatosTurnoSiguiente): string {
  const lineas = [`[Hoy es ${d.hoy}. Tu contexto de log y corridas es del ${d.contextoDel}.]`];
  if (d.ultimaCorrida && d.ultimaCorrida > d.contextoDel) {
    lineas.push(
      `[Hay una corrida registrada el ${d.ultimaCorrida}, posterior a tu contexto: no la conoces. ` +
        "Si la pregunta depende de datos recientes, dilo y sugiere abrir un chat nuevo.]",
    );
  }
  lineas.push(`Pregunta de la usuaria: ${d.mensaje}`);
  return lineas.join("\n");
}
