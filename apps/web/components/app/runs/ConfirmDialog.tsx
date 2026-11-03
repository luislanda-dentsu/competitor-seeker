"use client";

import { useState } from "react";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ObjecionUi {
  marca: string;
  problema: string;
}

export type AccionConfirmar = "registrar" | "descartar";

export interface ResultadoConfirmacion {
  corridaId: string;
  estado: string;
  registradas: number;
  duplicadas: string[];
}

/** Agrupa objeciones por competidor conservando el orden de aparición. */
export function agruparObjeciones(objeciones: readonly ObjecionUi[]): { marca: string; problemas: string[] }[] {
  const grupos = new Map<string, string[]>();
  for (const o of objeciones) {
    const lista = grupos.get(o.marca);
    if (lista) lista.push(o.problema);
    else grupos.set(o.marca, [o.problema]);
  }
  return [...grupos].map(([marca, problemas]) => ({ marca, problemas }));
}

export async function confirmarEnApi(corridaId: string, accion: AccionConfirmar): Promise<ResultadoConfirmacion> {
  const res = await fetch(`/api/corridas/${encodeURIComponent(corridaId)}/confirmar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accion }),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as Partial<ResultadoConfirmacion> & { error?: string };
  if (!res.ok) throw new Error(cuerpo.error ?? `Error ${res.status}`);
  return cuerpo as ResultadoConfirmacion;
}

/**
 * "La verificación no pasó": objeciones por competidor (Accordion) y
 * Descartar / Registrar de todos modos → POST /api/corridas/[id]/confirmar.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  corridaId,
  intentos,
  objeciones,
  onResuelto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corridaId: string;
  intentos: number;
  objeciones: readonly ObjecionUi[];
  onResuelto: (r: ResultadoConfirmacion) => void;
}): React.ReactElement {
  const [enCurso, setEnCurso] = useState<AccionConfirmar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const grupos = agruparObjeciones(objeciones);

  const ejecutar = async (accion: AccionConfirmar) => {
    setEnCurso(accion);
    setError(null);
    try {
      const r = await confirmarEnApi(corridaId, accion);
      onResuelto(r);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnCurso(null);
    }
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>La verificación no pasó</AlertDialogTitle>
          <AlertDialogDescription>
            El verificador rechazó las entradas tras {intentos} {intentos === 1 ? "intento" : "intentos"}. Nada se ha escrito en el
            log. Puedes descartar la corrida o registrarla de todos modos bajo tu criterio.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[50dvh] overflow-y-auto px-6 pb-4">
          {grupos.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin objeciones detalladas.</p>
          ) : (
            <Accordion defaultValue={[grupos[0]!.marca]} multiple>
              {grupos.map((g) => (
                <AccordionItem key={g.marca} value={g.marca}>
                  <AccordionTrigger className="py-3">
                    <span className="flex items-center gap-2">
                      {g.marca}
                      <Badge variant="warning">{g.problemas.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionPanel>
                    <ul className="flex flex-col gap-2 ps-4">
                      {g.problemas.map((p, i) => (
                        <li className="list-disc text-sm text-fg" key={i}>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          )}
          {error && (
            <p className="mt-3 text-sm text-s-no-funciona" role="alert">
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <Button disabled={enCurso !== null} loading={enCurso === "descartar"} onClick={() => void ejecutar("descartar")} variant="outline">
            Descartar
          </Button>
          <Button disabled={enCurso !== null} loading={enCurso === "registrar"} onClick={() => void ejecutar("registrar")}>
            Registrar de todos modos
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
