import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Aviso de líneas ilegibles en el log, archivos de corrida inválidos y
 * entradas cuya corrida no tiene archivo. Según soul.md, un fallo de lectura
 * NUNCA se interpreta como ausencia de movimientos.
 */
export function LogAlert({
  lineas,
  corridasInvalidas = 0,
  entradasSinCorrida = 0,
}: {
  lineas: { n: number; error: string }[];
  corridasInvalidas?: number;
  /** Entradas del log cuya corrida no existe en `corridas/`. */
  entradasSinCorrida?: number;
}): React.ReactElement | null {
  if (lineas.length === 0 && corridasInvalidas === 0 && entradasSinCorrida === 0) return null;
  const n = lineas.length;
  const titulo =
    n > 0
      ? `El log tiene ${n} ${n === 1 ? "línea ilegible" : "líneas ilegibles"}.`
      : corridasInvalidas > 0
        ? "Hay archivos de corrida ilegibles."
        : "Hay entradas sin archivo de corrida.";
  return (
    <Alert variant="error">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>
        {titulo} Esto NO significa que no haya movimientos.
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
        {entradasSinCorrida > 0 && (
          <span>
            {entradasSinCorrida}{" "}
            {entradasSinCorrida === 1
              ? "entrada pertenece a una corrida sin archivo"
              : "entradas pertenecen a corridas sin archivo"}{" "}
            en <code>corridas/</code>: se muestran igual en tendencia e histórico.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
