// Solo servidor: usa el core (node:fs). Los componentes cliente reciben
// únicamente los objetos planos que exporta este módulo.
import {
  competidoresActivos,
  conteoPorSenal,
  kpisMarca,
  leerLog,
  leerMarca,
  listarCorridas,
  semaforoPorCompetidor,
  type ConteoSenales,
  type Corrida,
  type CorridaInvalida,
  type Entrada,
  type KpisMarca,
  type LineaInvalida,
  type Marca,
  type PuntoSerie,
  type Senal,
} from "@competitor-seeker/core";
import { cache } from "react";
import {
  agruparPorCorrida,
  contarEntradasSinCorrida,
  contarSenales,
  resolverSlugsCompetidores,
  serieDesdeGrupos,
} from "./agrupar";

/** Resumen por competidor para listas, tablas y sidebar (serializable). */
export interface CompetidorResumen {
  slug: string;
  nombre: string;
  url?: string;
  instagram?: string;
  activo: boolean;
  /** Entrada más reciente (semáforo); null si no tiene registros. */
  semaforo: Entrada | null;
  senal: Senal | null;
  total: number;
  conteo: ConteoSenales;
  ultimaFecha: string | null;
}

export interface DatosMarca {
  marca: Marca;
  entradas: Entrada[];
  lineasInvalidas: LineaInvalida[];
  corridas: Corrida[];
  corridasInvalidas: CorridaInvalida[];
  kpis: KpisMarca;
  /** Nombre de competidor → entrada más reciente (empate → señal más grave). */
  semaforo: Map<string, Entrada>;
  conteo: ConteoSenales;
  /**
   * Un punto por corrida con entradas (cronológico), incluidas las corridas
   * no registradas y las que no tienen archivo: toda entrada del log cuenta.
   */
  serie: PuntoSerie[];
  /** Entradas cuya corrida no tiene archivo en `corridas/`. */
  entradasSinCorrida: number;
  competidores: CompetidorResumen[];
}

function resumirCompetidores(
  marca: Marca,
  entradas: readonly Entrada[],
  semaforo: Map<string, Entrada>,
): CompetidorResumen[] {
  const porNombre = new Map<string, Entrada[]>();
  for (const e of entradas) {
    const lista = porNombre.get(e.marca);
    if (lista) lista.push(e);
    else porNombre.set(e.marca, [e]);
  }
  const enLista = new Map(marca.competidores.map((c) => [c.nombre, c] as const));
  // Slugs únicos y orden: activos de la lista, luego los que solo aparecen en
  // el log (o están inactivos), marcados como inactivos.
  return resolverSlugsCompetidores(marca.competidores, porNombre.keys()).map(({ nombre, slug }) => {
    const base = enLista.get(nombre);
    const propias = porNombre.get(nombre) ?? [];
    const sem = semaforo.get(nombre) ?? null;
    return {
      slug,
      nombre,
      ...(base?.url ? { url: base.url } : {}),
      ...(base?.instagram ? { instagram: base.instagram } : {}),
      activo: base?.activo ?? false,
      semaforo: sem,
      senal: sem?.senal ?? null,
      total: propias.length,
      conteo: contarSenales(propias),
      ultimaFecha: sem?.fecha ?? null,
    };
  });
}

/**
 * Carga todo lo que necesita la Home de una marca. Memoizada por request
 * con `React.cache`: varias islas pueden llamarla sin releer el disco.
 * Lanza si `marca.json` no existe o es inválido.
 */
export const cargarDatosMarca = cache((slug: string): DatosMarca => {
  const marca = leerMarca(slug);
  const { items: entradas, lineasInvalidas } = leerLog(slug);
  const { corridas, invalidas: corridasInvalidas } = listarCorridas(slug);
  const semaforo = semaforoPorCompetidor(entradas);
  const grupos = agruparPorCorrida(entradas, corridas);
  const kpis = kpisMarca({
    entradas,
    corridas,
    competidoresVigilados: competidoresActivos(marca).length,
  });
  return {
    marca,
    entradas,
    lineasInvalidas,
    corridas,
    corridasInvalidas,
    kpis,
    semaforo,
    conteo: conteoPorSenal(entradas),
    serie: serieDesdeGrupos(grupos),
    entradasSinCorrida: contarEntradasSinCorrida(grupos),
    competidores: resumirCompetidores(marca, entradas, semaforo),
  };
});
