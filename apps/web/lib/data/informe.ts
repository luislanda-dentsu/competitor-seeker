// Informe exportable (PDF): todo el detalle de cada competidor dentro de un periodo.
// Puro salvo `cargarInforme`, que lee la marca del disco.
import { enPeriodo, metricasCompetidor, type Corrida, type Entrada, type MetricasCompetidor, type Periodo } from "@competitor-seeker/core";
import { agruparPorCorrida, contarSenales, evolucionPorCorrida, ordenarPorFechaDesc, type ConteoSenales, type GrupoCorrida, type PuntoEvolucion } from "./agrupar";
import { cargarDatosMarca, type CompetidorResumen } from "./marca";

export interface InformeCompetidor {
  competidor: Pick<CompetidorResumen, "slug" | "nombre" | "url" | "instagram">;
  metricas: MetricasCompetidor;
  /** Movimientos del periodo (por fecha de la entrada), agrupados por corrida. */
  movimientos: GrupoCorrida[];
  conteo: ConteoSenales;
  /** Señales por corrida, solo con las entradas del periodo. */
  evolucion: PuntoEvolucion[];
}

export interface Informe {
  marca: { slug: string; nombre: string };
  periodo: Periodo;
  competidores: InformeCompetidor[];
}

/**
 * Filtra por la fecha de cada ENTRADA (no la de su corrida): una corrida histórica del
 * 2026-11-13 trae movimientos de 2025 y deben salir en un informe de ese periodo.
 */
export function construirInforme(
  marca: { slug: string; nombre: string },
  competidores: readonly InformeCompetidor["competidor"][],
  entradas: readonly Entrada[],
  corridas: readonly Corrida[],
  periodo: Periodo,
  hoy?: string,
): Informe {
  return {
    marca,
    periodo,
    competidores: competidores.map((c) => {
      const propias = ordenarPorFechaDesc(entradas.filter((e) => e.marca === c.nombre && enPeriodo(e.fecha, periodo)));
      const movimientos = agruparPorCorrida(propias, corridas);
      return {
        competidor: c,
        metricas: metricasCompetidor(corridas, c.nombre, { periodo, ...(hoy ? { hoy } : {}) }),
        movimientos,
        conteo: contarSenales(propias),
        evolucion: evolucionPorCorrida(movimientos),
      };
    }),
  };
}

export function cargarInforme(slug: string, periodo: Periodo): Informe {
  const d = cargarDatosMarca(slug);
  const competidores = d.competidores.map(({ slug: s, nombre, url, instagram }) => ({
    slug: s,
    nombre,
    ...(url ? { url } : {}),
    ...(instagram ? { instagram } : {}),
  }));
  return construirInforme({ slug: d.marca.slug, nombre: d.marca.nombre }, competidores, d.entradas, d.corridas, periodo);
}
