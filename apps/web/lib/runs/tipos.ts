/** Tipos serializables que cruzan la frontera servidor → cliente en Corridas. */

export interface MarcaUi {
  slug: string;
  nombre: string;
  /** Competidores activos. */
  competidores: number;
  /** Competidores activos con perfil de Instagram (para la estimación de Apify). */
  perfilesIg: number;
}

export interface ApifyUi {
  /** Hay token configurado (`data/secrets.json` o `APIFY_TOKEN`) y Apify está habilitado en config. */
  disponible: boolean;
  motivo?: string;
  resultsLimit: number;
  usdPorResultado: number;
}

/** Ventana de una corrida histórica (fechas `AAAA-MM-DD`; vacías mientras se eligen). */
export interface VentanaUi {
  desde: string;
  hasta: string;
}

/** Lo que el lanzador manda para una corrida histórica. */
export interface LanzarHistorica {
  ventana: VentanaUi;
  topePosts: number;
}

/** Respuesta de `GET /api/corridas/estimacion` (espejo de `EstimacionHistorica` del core). */
export interface EstimacionHistoricaUi {
  dias: number;
  competidores: { competidor: string; cadencia: number; observada: boolean; postsEstimados: number }[];
  postsEstimados: number;
  costeEstimadoUsd: number;
  topePosts: number;
  costeMaximoUsd: number;
}

export interface CorridaActiva {
  corridaId: string;
  marca: string;
  /** ISO. */
  inicio: string;
}

/** Rutas de la UI y la API de una corrida (siempre namespaceadas por marca). */
export function rutaUiCorrida(marca: string, corridaId: string): `/corridas/${string}/${string}` {
  return `/corridas/${encodeURIComponent(marca)}/${encodeURIComponent(corridaId)}`;
}

export function rutaApiCorrida(marca: string, corridaId: string): string {
  return `/api/corridas/${encodeURIComponent(marca)}/${encodeURIComponent(corridaId)}`;
}
