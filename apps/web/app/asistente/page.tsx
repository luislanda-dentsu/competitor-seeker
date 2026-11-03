import { UnderConstruction } from "@/components/app/states/UnderConstruction";

export const metadata = { title: "Asistente" };

export default function AsistentePage() {
  return (
    <UnderConstruction
      detalle="Chat con el asistente sobre el log de la marca: historial, tarjetas de sugerencia, Composer y panel de artefactos."
      fase={6}
      titulo="Asistente"
    />
  );
}
