import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Aviso de líneas ilegibles en el log. Según soul.md, un fallo de lectura
 * NUNCA se interpreta como ausencia de movimientos.
 */
export function LogAlert({
  lineas,
  corridasInvalidas = 0,
}: {
  lineas: { n: number; error: string }[];
  corridasInvalidas?: number;
}): React.ReactElement | null {
  if (lineas.length === 0 && corridasInvalidas === 0) return null;
  const n = lineas.length;
  return (
    <Alert variant="error">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>
        {n > 0
          ? `El log tiene ${n} ${n === 1 ? "línea ilegible" : "líneas ilegibles"}.`
          : "Hay archivos de corrida ilegibles."}{" "}
        Esto NO significa que no haya movimientos.
      </AlertTitle>
      <AlertDescription>
        {n > 0 && (
          <ul className="font-mono text-xs">
            {lineas.slice(0, 5).map((l) => (
              <li key={l.n}>
                línea {l.n}: {l.error}
              </li>
            ))}
            {n > 5 && <li>… y {n - 5} más</li>}
          </ul>
        )}
        {corridasInvalidas > 0 && (
          <span>
            {corridasInvalidas}{" "}
            {corridasInvalidas === 1 ? "archivo de corrida inválido" : "archivos de corrida inválidos"}{" "}
            en <code>corridas/</code>.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
