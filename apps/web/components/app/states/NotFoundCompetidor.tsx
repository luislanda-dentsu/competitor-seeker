import { UserX } from "lucide-react";
import { EmptyState } from "@/components/app/states/EmptyState";

/** Slug de competidor desconocido: Empty con enlace a Ajustes. */
export function NotFoundCompetidor(): React.ReactElement {
  return (
    <EmptyState
      accion={{ href: "/ajustes", label: "Revisar la lista de vigilancia" }}
      descripcion="Ese competidor no está en la lista de vigilancia de la marca activa ni aparece en su log. Si lo diste de alta en otra marca, cámbiala en el selector de arriba."
      icon={UserX}
      secundaria={{ href: "/competidores", label: "Ver todos los competidores" }}
      titulo="Competidor no encontrado"
    />
  );
}
