// Solo servidor: métricas de rendimiento por competidor para el periodo elegido.
import { metricasCompetidor, type MetricasCompetidor, type Periodo } from "@competitor-seeker/core";
import { cargarDatosMarca, type CompetidorResumen } from "./marca";

export interface ActividadCompetidor {
  competidor: Pick<CompetidorResumen, "slug" | "nombre" | "instagram" | "activo">;
  metricas: MetricasCompetidor;
}

/**
 * Una fila por competidor activo, ordenada por actividad del periodo
 * (posts, luego ER). Los inactivos solo aparecen si tienen posts en el periodo.
 */
export function cargarActividad(slug: string, periodo: Periodo, hoy?: string): ActividadCompetidor[] {
  const datos = cargarDatosMarca(slug);
  return datos.competidores
    .map((c) => ({
      competidor: { slug: c.slug, nombre: c.nombre, activo: c.activo, ...(c.instagram ? { instagram: c.instagram } : {}) },
      metricas: metricasCompetidor(datos.corridas, c.nombre, { periodo, ...(hoy ? { hoy } : {}) }),
    }))
    .filter((a) => a.competidor.activo || a.metricas.posts > 0)
    .sort((a, b) => b.metricas.posts - a.metricas.posts || (b.metricas.er.promedio ?? -1) - (a.metricas.er.promedio ?? -1));
}
