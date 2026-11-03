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

export interface CorridaActiva {
  corridaId: string;
  marca: string;
  /** ISO. */
  inicio: string;
}
