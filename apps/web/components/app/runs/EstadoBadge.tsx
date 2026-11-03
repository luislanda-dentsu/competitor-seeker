import { Badge } from "@/components/ui/badge";

const META: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "secondary" | "outline" }> = {
  registrada: { label: "Registrada", variant: "success" },
  "pendiente-confirmacion": { label: "Pendiente", variant: "warning" },
  "en-curso": { label: "En curso", variant: "info" },
  descartada: { label: "Descartada", variant: "secondary" },
  error: { label: "Error", variant: "error" },
};

/** Píldora del estado de una corrida (siempre con texto, nunca solo color). */
export function EstadoBadge({ estado, className }: { estado: string; className?: string }): React.ReactElement {
  const meta = META[estado] ?? { label: estado, variant: "outline" as const };
  return (
    <Badge className={className} data-estado={estado} variant={meta.variant}>
      {meta.label}
    </Badge>
  );
}
