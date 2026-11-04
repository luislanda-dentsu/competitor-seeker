// Tipos compartidos entre el servidor (API) y el cliente (UI) del asistente.
// Solo tipos planos: este módulo no importa nada de Node.

export interface EntradaCitada {
  id: string;
  marca: string;
  fecha: string;
  senal: string;
  movimiento: string;
  lectura: string;
}

/** Artefacto resuelto: el bloque del modelo más las entradas del log por id. */
export interface ArtefactoUi {
  titulo: string;
  ids: string[];
  entradas: EntradaCitada[];
  /** Ids que el modelo citó pero no existen en el log. */
  faltantes: string[];
}

export type RolMensaje = "usuario" | "asistente";
export type Feedback = "up" | "down";

export interface MensajeUi {
  rol: RolMensaje;
  texto: string;
  ts: string;
  artefacto?: ArtefactoUi;
  feedback?: Feedback;
}

export interface ChatUi {
  id: string;
  marca: string;
  titulo: string;
  creado: string;
  actualizado: string;
  /** ISO: cuándo se construyó el contexto del primer turno (o la creación del chat si es anterior al campo). */
  contextoEn: string;
  /** Hay una corrida registrada posterior al contexto. */
  corridasNuevas: boolean;
  mensajes: MensajeUi[];
}

export interface ChatResumenUi {
  id: string;
  marca: string;
  titulo: string;
  creado: string;
  actualizado: string;
  mensajes: number;
}

export interface Sugerencia {
  id: string;
  texto: string;
  /** Por qué se sugiere (p. ej. "2 entradas no-funciona"). */
  motivo?: string;
}

/** Eventos SSE de `POST /api/asistente`. */
export type EventoChat =
  | { tipo: "delta"; texto: string }
  | { tipo: "thinking"; activo: boolean; texto?: string }
  | { tipo: "artifact"; artefacto: ArtefactoUi }
  | { tipo: "done"; chatId: string; titulo: string; actualizado: string }
  | { tipo: "error"; error: string };
