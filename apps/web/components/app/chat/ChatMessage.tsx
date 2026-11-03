"use client";

import { TableProperties } from "lucide-react";
import ShinyText from "@/components/bits/ShinyText";
import { Markdown } from "@/components/app/chat/Markdown";
import { MessageActions } from "@/components/app/chat/MessageActions";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ArtefactoUi, Feedback, MensajeUi } from "@/lib/chat/tipos";
import { cn } from "@/lib/utils";

/** Indicador "Pensando…" (ShinyText de React Bits; estático con prefers-reduced-motion). */
export function Pensando({ texto }: { texto: string }): React.ReactElement {
  const reducido = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <div aria-live="polite" className="flex h-7 items-center text-sm" role="status">
      <ShinyText className="text-sm" color="var(--fg-muted)" disabled={reducido} shineColor="var(--fg)" speed={2.4} text={texto} />
    </div>
  );
}

export interface ChatMessageProps {
  mensaje: MensajeUi;
  indice: number;
  /** Es el último mensaje del asistente (se puede regenerar). */
  ultimo: boolean;
  generando: boolean;
  pensando: string | null;
  onFeedback: (indice: number, f: Feedback | null) => void;
  onRegenerar: () => void;
  onVerArtefacto: (a: ArtefactoUi) => void;
}

export function ChatMessage({ mensaje, indice, ultimo, generando, pensando, onFeedback, onRegenerar, onVerArtefacto }: ChatMessageProps): React.ReactElement {
  if (mensaje.rol === "usuario") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-card px-4 py-2.5 text-[15px] leading-relaxed text-fg shadow-xs">
          {mensaje.texto}
        </div>
      </div>
    );
  }

  const enCurso = generando && ultimo;
  const n = mensaje.artefacto?.entradas.length ?? 0;
  return (
    <div className="group flex flex-col gap-2" tabIndex={-1}>
      {mensaje.texto !== "" && <Markdown texto={mensaje.texto} />}
      {enCurso && pensando && <Pensando texto={pensando} />}
      {mensaje.artefacto && (
        <div>
          <Button className="gap-1.5 rounded-pill text-fg-muted" onClick={() => onVerArtefacto(mensaje.artefacto!)} size="xs" variant="outline">
            <TableProperties aria-hidden="true" />
            Ver {n} {n === 1 ? "entrada citada" : "entradas citadas"}
            {mensaje.artefacto.faltantes.length > 0 && (
              <span className="text-fg-dim">· {mensaje.artefacto.faltantes.length} sin resolver</span>
            )}
          </Button>
        </div>
      )}
      {!enCurso && mensaje.texto !== "" && (
        <MessageActions
          className={cn(ultimo && "opacity-100")}
          disabled={generando}
          feedback={mensaje.feedback}
          onFeedback={(f) => onFeedback(indice, f)}
          onRegenerar={ultimo ? onRegenerar : undefined}
          texto={mensaje.texto}
        />
      )}
    </div>
  );
}
