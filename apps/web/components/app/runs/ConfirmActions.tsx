"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, type ObjecionUi } from "@/components/app/runs/ConfirmDialog";

/** Botón "Resolver" del detalle de una corrida pendiente: abre el diálogo de confirmación. */
export function ConfirmActions({
  corridaId,
  intentos,
  objeciones,
}: {
  corridaId: string;
  intentos: number;
  objeciones: readonly ObjecionUi[];
}): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        Resolver
      </Button>
      <ConfirmDialog
        corridaId={corridaId}
        intentos={intentos}
        objeciones={objeciones}
        onOpenChange={setOpen}
        onResuelto={() => router.refresh()}
        open={open}
      />
    </>
  );
}
