import { UnderConstruction } from "@/components/app/states/UnderConstruction";

export const metadata = { title: "Corridas" };

export default function CorridasPage() {
  return (
    <UnderConstruction
      detalle="Lanzador de corridas, consola en vivo con las fases Rastreo / Análisis / Verificación y el histórico de corridas."
      fase={5}
      titulo="Corridas"
    />
  );
}
