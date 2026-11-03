"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const mensaje =
    error instanceof Error && error.message ? error.message : "Error desconocido.";

  return (
    <Alert variant="error">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Algo falló al cargar esta vista</AlertTitle>
      <AlertDescription>
        <span>{mensaje}</span>
        <span>
          Esto NO significa que no haya movimientos: solo que el panel no pudo
          leer los datos.
        </span>
      </AlertDescription>
      <AlertAction>
        <Button onClick={() => retry()} size="sm" variant="outline">
          <RefreshCw aria-hidden="true" />
          Reintentar
        </Button>
      </AlertAction>
    </Alert>
  );
}
