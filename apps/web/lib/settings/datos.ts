// Solo servidor (Node): carga de datos de Ajustes y lectura del estado del token.
import {
  cargarEnv,
  competidoresActivos,
  leerConfig,
  leerMarca,
  leerSecrets,
  leerSecretsArchivo,
  listarCorridas,
  listarMarcas,
  ultimaCorridaRegistrada,
  type Marca,
} from "@competitor-seeker/core";
import { cookies } from "next/headers";
import { MARCA_COOKIE } from "@/lib/brand-cookie";
import type { DatosAjustes, EstadoChrome, EstadoToken, MarcaAjustes } from "@/lib/settings/tipos";

/** Estado del token sin exponerlo: solo si existe y sus últimos 4 caracteres. */
export function estadoToken(): EstadoToken {
  let token: string | undefined;
  try {
    token = leerSecrets().apifyToken;
  } catch {
    token = undefined;
  }
  if (!token) return { configurado: false };
  const desdeEntorno = Boolean(cargarEnv().APIFY_TOKEN) && leerSecretsArchivo().apifyToken !== token;
  return { configurado: true, ultimos4: token.slice(-4), ...(desdeEntorno ? { desdeEntorno: true } : {}) };
}

function resumirMarca(m: Marca): MarcaAjustes {
  return {
    slug: m.slug,
    nombre: m.nombre,
    creadaEn: m.creadaEn,
    competidores: competidoresActivos(m).length,
    ultimaCorrida: ultimaCorridaRegistrada(m.slug),
  };
}

function estadoChrome(slug: string | null): EstadoChrome {
  if (!slug) return { marca: null, sesion: null, corridaId: null, fecha: null };
  const ultima = listarCorridas(slug).corridas.find((c) => c.estado !== "en-curso") ?? null;
  return {
    marca: slug,
    sesion: ultima?.ig?.sesion ?? null,
    corridaId: ultima?.id ?? null,
    fecha: ultima?.fecha ?? null,
  };
}

/** Lee cookies y disco: llamar dentro de Suspense. */
export async function cargarDatosAjustes(): Promise<DatosAjustes> {
  const marcas = listarMarcas();
  const jar = await cookies();
  const cookie = jar.get(MARCA_COOKIE)?.value;
  const activa = marcas.find((m) => m.slug === cookie)?.slug ?? marcas[0]?.slug ?? null;
  let competidores: DatosAjustes["competidores"] = [];
  if (activa) {
    try {
      competidores = leerMarca(activa).competidores.map((c) => ({
        slug: c.slug,
        nombre: c.nombre,
        url: c.url ?? "",
        ...(c.instagram ? { instagram: c.instagram } : {}),
        activo: c.activo,
      }));
    } catch {
      competidores = [];
    }
  }
  return {
    marcas: marcas.map(resumirMarca),
    activa,
    competidores,
    token: estadoToken(),
    config: leerConfig().apify,
    chrome: estadoChrome(activa),
  };
}
