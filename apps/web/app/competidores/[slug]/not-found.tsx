import { NotFoundCompetidor } from "@/components/app/states/NotFoundCompetidor";

/**
 * Red de seguridad para notFound() dentro de la isla (p. ej. slug válido
 * en otra marca). El 404 real de slugs desconocidos lo decide proxy.ts.
 */
export default function CompetidorNoEncontrado(): React.ReactElement {
  return <NotFoundCompetidor />;
}
