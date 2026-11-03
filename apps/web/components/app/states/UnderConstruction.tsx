import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Placeholder de página mientras llega su fase. */
export function UnderConstruction({
  fase,
  titulo = "En construcción",
  detalle,
  className,
}: {
  fase: number;
  titulo?: string;
  detalle?: string;
  className?: string;
}): React.ReactElement {
  return (
    <Card className={cn("rounded-lg", className)}>
      <CardHeader>
        <CardTitle className="font-normal text-fg">
          {titulo} · Fase {fase}
        </CardTitle>
        <CardDescription className="text-fg-muted">
          {detalle ??
            "Esta sección se implementa en una fase posterior del plan. El shell, los tokens y la navegación ya están listos."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
