import { Bot, MessageSquareOff } from "lucide-react";
import { EmptyState } from "@/components/app/states/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

export function SinMarcas(): React.ReactElement {
  return (
    <EmptyState
      accion={{ href: "/ajustes", label: "Ir a Ajustes" }}
      descripcion="El asistente conversa sobre los hallazgos de una marca. Da de alta la primera en Ajustes."
      icon={Bot}
      titulo="No hay marcas"
    />
  );
}

export function ChatNoEncontrado(): React.ReactElement {
  return (
    <EmptyState
      accion={{ href: "/asistente", label: "Nuevo chat" }}
      descripcion="Ese chat no existe para la marca activa o se borró del historial local."
      icon={MessageSquareOff}
      titulo="Chat no encontrado"
    />
  );
}

export function CargandoChat(): React.ReactElement {
  return (
    <div aria-busy="true" aria-label="Cargando asistente" className="mx-auto flex max-w-3xl flex-col gap-6 pt-16">
      <Skeleton className="h-9 w-2/3" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}
