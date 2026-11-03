// Tipos serializables que cruzan servidor → cliente en Ajustes.
import type { ConfigApify, SesionIg } from "@competitor-seeker/core";

export interface MarcaAjustes {
  slug: string;
  nombre: string;
  creadaEn: string;
  competidores: number;
  /** Fecha `AAAA-MM-DD` de la última corrida registrada, o null. */
  ultimaCorrida: string | null;
}

export interface CompetidorAjustes {
  slug: string;
  nombre: string;
  url: string;
  instagram?: string;
  activo: boolean;
}

/** Lo que `GET /api/ajustes/apify` devuelve: nunca el token. */
export interface EstadoToken {
  configurado: boolean;
  ultimos4?: string;
  /** El token viene de `APIFY_TOKEN` (entorno), no del archivo. */
  desdeEntorno?: boolean;
}

export interface EstadoChrome {
  marca: string | null;
  /** `ig.sesion` de la última corrida de la marca activa (null si no hay corridas). */
  sesion: SesionIg | null;
  corridaId: string | null;
  fecha: string | null;
}

export interface DatosAjustes {
  marcas: MarcaAjustes[];
  activa: string | null;
  competidores: CompetidorAjustes[];
  token: EstadoToken;
  config: ConfigApify;
  chrome: EstadoChrome;
}
