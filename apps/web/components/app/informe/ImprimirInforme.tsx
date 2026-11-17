"use client";

import { Download } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Barra del informe (no se imprime): «Guardar como PDF» abre el diálogo de impresión del
 * navegador (el papel va siempre en claro: tokens propios de `.informe` en globals.css).
 * Con `auto`, abre el diálogo al cargar, cuando ya están las fuentes.
 */
export function ImprimirInforme({ auto, nombreArchivo }: { auto: boolean; nombreArchivo: string }): React.ReactElement {
  // El navegador usa el título del documento como nombre del PDF.
  useEffect(() => {
    const anterior = document.title;
    document.title = nombreArchivo;
    return () => {
      document.title = anterior;
    };
  }, [nombreArchivo]);

  useEffect(() => {
    if (!auto) return;
    let cancelado = false;
    void document.fonts.ready.then(() => {
      if (!cancelado) setTimeout(() => window.print(), 150);
    });
    return () => {
      cancelado = true;
    };
  }, [auto]);

  return (
    <Button onClick={() => window.print()} size="sm">
      <Download aria-hidden="true" />
      Guardar como PDF
    </Button>
  );
}
