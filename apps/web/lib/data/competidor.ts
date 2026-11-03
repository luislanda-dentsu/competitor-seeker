// Solo servidor: ficha de un competidor dentro de una marca.
import type { Entrada, Senal } from "@competitor-seeker/core";
import { cache } from "react";
import {
  agruparPorCorrida,
  enlacesEvidencia,
  evolucionPorCorrida,
  ordenarPorFechaDesc,
  pctConEvidencia,
  type ConteoSenales,
  type GrupoCorrida,
  type PuntoEvolucion,
} from "./agrupar";
import { cargarDatosMarca, type CompetidorResumen } from "./marca";

export interface DatosCompetidor {
  marcaSlug: string;
  marcaNombre: string;
  competidor: CompetidorResumen;
  /** Todas sus entradas, más recientes primero. */
  entradas: Entrada[];
  /** Agrupadas por corrida (más reciente primero). */
  grupos: GrupoCorrida[];
  /** Una fila por corrida, cronológico ascendente. */
  evolucion: PuntoEvolucion[];
  evidencia: string[];
  /** Entradas que traen `metricas` (Apify), más recientes primero. */
  conMetricas: Entrada[];
  conteo: ConteoSenales;
  senal: Senal | null;
  nCorridas: number;
  pctConEvidencia: number;
}

/**
 * Carga la ficha de `competidorSlug` dentro de `slug`. Devuelve null si el
 * competidor no está en la lista de vigilancia ni aparece en el log.
 */
export const cargarCompetidor = cache(
  (slug: string, competidorSlug: string): DatosCompetidor | null => {
    const datos = cargarDatosMarca(slug);
    const competidor = datos.competidores.find((c) => c.slug === competidorSlug);
    if (!competidor) return null;
    const propias = ordenarPorFechaDesc(
      datos.entradas.filter((e) => e.marca === competidor.nombre),
    );
    const grupos = agruparPorCorrida(propias, datos.corridas);
    return {
      marcaSlug: datos.marca.slug,
      marcaNombre: datos.marca.nombre,
      competidor,
      entradas: propias,
      grupos,
      evolucion: evolucionPorCorrida(grupos),
      evidencia: enlacesEvidencia(propias),
      conMetricas: propias.filter((e) => e.metricas !== undefined),
      conteo: competidor.conteo,
      senal: competidor.senal,
      nCorridas: grupos.length,
      pctConEvidencia: pctConEvidencia(propias),
    };
  },
);
