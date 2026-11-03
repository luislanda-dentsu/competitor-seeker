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
  seriePorCorrida,
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
import { contarSenales, slugDeCompetidor } from "./agrupar";

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
  serie: PuntoSerie[];
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
  const salida: CompetidorResumen[] = [];
  const vistos = new Set<string>();
  const construir = (
    nombre: string,
    base: Partial<Pick<CompetidorResumen, "slug" | "url" | "instagram" | "activo">>,
  ): CompetidorResumen => {
    const propias = porNombre.get(nombre) ?? [];
    const sem = semaforo.get(nombre) ?? null;
    return {
      slug: base.slug ?? slugDeCompetidor(nombre, marca.competidores),
      nombre,
      ...(base.url ? { url: base.url } : {}),
      ...(base.instagram ? { instagram: base.instagram } : {}),
      activo: base.activo ?? false,
      semaforo: sem,
      senal: sem?.senal ?? null,
      total: propias.length,
      conteo: contarSenales(propias),
      ultimaFecha: sem?.fecha ?? null,
    };
  };
  for (const c of competidoresActivos(marca)) {
    vistos.add(c.nombre);
    salida.push(construir(c.nombre, c));
  }
  // Competidores que aparecen en el log pero ya no están (o están inactivos)
  // en la lista: se muestran igual, marcados como inactivos.
  for (const nombre of porNombre.keys()) {
    if (vistos.has(nombre)) continue;
    vistos.add(nombre);
    const enLista = marca.competidores.find((c) => c.nombre === nombre);
    salida.push(construir(nombre, { ...enLista, activo: false }));
  }
  return salida;
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
    serie: seriePorCorrida(entradas, corridas),
    competidores: resumirCompetidores(marca, entradas, semaforo),
  };
});
