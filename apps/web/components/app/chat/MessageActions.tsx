"use client";

import { Copy, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import type { Feedback } from "@/lib/chat/tipos";
import { cn } from "@/lib/utils";

export interface MessageActionsProps {
  texto: string;
  feedback?: Feedback;
  onFeedback: (f: Feedback | null) => void;
  /** Solo el último mensaje del asistente se puede regenerar. */
  onRegenerar?: () => void;
  disabled?: boolean;
  className?: string;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function Accion({
  label,
  onClick,
  activo,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  activo?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={activo}
            className={cn("text-fg-dim hover:text-fg", activo && "bg-card-2 text-fg")}
            disabled={disabled}
            onClick={onClick}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

/** Copiar · 👍 · 👎 · Regenerar. Visible al hover o foco del mensaje (clase `group`). */
export function MessageActions({ texto, feedback, onFeedback, onRegenerar, disabled, className }: MessageActionsProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none",
        feedback && "opacity-100",
        className,
      )}
      role="toolbar"
      aria-label="Acciones del mensaje"
    >
      <Accion
        label="Copiar"
        onClick={() => {
          void copiar(texto).then((ok) =>
            toastManager.add(ok ? { title: "Copiado", type: "success", timeout: 1500 } : { title: "No se pudo copiar", type: "error" }),
          );
        }}
      >
        <Copy aria-hidden="true" />
      </Accion>
      <Accion activo={feedback === "up"} disabled={disabled} label="Respuesta útil" onClick={() => onFeedback(feedback === "up" ? null : "up")}>
        <ThumbsUp aria-hidden="true" />
      </Accion>
      <Accion activo={feedback === "down"} disabled={disabled} label="Respuesta poco útil" onClick={() => onFeedback(feedback === "down" ? null : "down")}>
        <ThumbsDown aria-hidden="true" />
      </Accion>
      {onRegenerar && (
        <Accion disabled={disabled} label="Regenerar" onClick={onRegenerar}>
          <RefreshCw aria-hidden="true" />
        </Accion>
      )}
    </div>
  );
}
