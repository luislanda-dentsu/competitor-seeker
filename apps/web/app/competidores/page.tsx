import { UnderConstruction } from "@/components/app/states/UnderConstruction";

export const metadata = { title: "Competidores" };

export default function CompetidoresPage() {
  return (
    <UnderConstruction
      detalle="Lista de competidores de la marca activa con semáforo por señal, tabla en escritorio y cards en móvil."
      fase={3}
      titulo="Competidores"
    />
  );
}
