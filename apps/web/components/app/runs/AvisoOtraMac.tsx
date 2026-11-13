import { MonitorSmartphone } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fmtFecha } from "@/lib/format";
import { corridaEnOtraMac } from "@/lib/runs/otra-mac";

/**
 * Aviso (no bloqueo): la otra Mac del equipo tiene una corrida en curso. Si se lanza otra de la
 * misma marca aquí, el histórico no se rompe (merge=union) pero se duplica el gasto.
 */
export async function AvisoOtraMac(): Promise<React.ReactElement | null> {
  const c = await corridaEnOtraMac();
  if (!c) return null;
  const hora = new Date(c.inicio).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
  return (
    <Alert variant="warning">
      <MonitorSmartphone aria-hidden="true" />
      <AlertTitle>Hay una corrida en curso en la otra Mac</AlertTitle>
      <AlertDescription>
        Marca «{c.marca}», empezó el {fmtFecha(c.inicio.slice(0, 10))} a las {hora}. Aparecerá aquí al registrarse y sincronizarse; no lances otra de
        la misma marca mientras tanto.
      </AlertDescription>
    </Alert>
  );
}
