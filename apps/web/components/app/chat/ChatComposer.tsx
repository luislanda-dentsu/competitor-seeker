"use client";

import { ArrowUp, Sparkles, Square } from "lucide-react";
import { useRef } from "react";
import {
  Composer,
  ComposerActionGroup,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
  getComposerText,
  type ComposerValue,
} from "@/components/ui/composer";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ChatComposerProps {
  marcaNombre: string;
  generando: boolean;
  disabled?: boolean;
  onEnviar: (texto: string) => void;
  onDetener: () => void;
}

/**
 * Composer de coss/ui: chip "✦ Asistente · marca", Enter envía / Shift+Enter
 * salto, botón circular → cuadrado "stop" mientras genera.
 */
export function ChatComposer({ marcaNombre, generando, disabled, onEnviar, onDetener }: ChatComposerProps): React.ReactElement {
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (value: ComposerValue) => {
    const texto = getComposerText(value).trim();
    if (texto === "" || generando) return;
    onEnviar(texto);
    formRef.current?.reset();
  };

  return (
    <Composer
      aria-label="Mensaje para el asistente"
      className="rounded-2xl border-border bg-card shadow-xs [--composer-max-rows:6] [--composer-min-rows:1] md:[--composer-min-rows:1]"
      disabled={disabled}
      onSubmit={submit}
      ref={formRef}
      submitDisabled={generando}
      submitOnEnter="always"
    >
      <ComposerInput className="text-[15px] text-fg placeholder:text-fg-dim data-empty:before:text-fg-dim md:text-[15px]" placeholder="¿En qué te ayudo?" />
      <ComposerActions>
        <ComposerActionGroup>
          <span
            className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-card-2 px-2.5 text-xs font-medium text-fg-muted"
            data-slot="composer-chip"
          >
            <Sparkles aria-hidden="true" className="size-3" />
            Asistente · {marcaNombre}
          </span>
        </ComposerActionGroup>
        <ComposerActionGroup align="end">
          {generando ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Detener respuesta"
                    className="size-8 rounded-full border-primary bg-primary text-primary-fg sm:size-8"
                    onClick={onDetener}
                    size="icon-sm"
                    type="button"
                  />
                }
              >
                <Square aria-hidden="true" className="size-3.5 fill-current" />
              </TooltipTrigger>
              <TooltipPopup>Detener (Esc)</TooltipPopup>
            </Tooltip>
          ) : (
            <ComposerSubmit
              aria-label="Enviar (Enter)"
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg transition-opacity",
                "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35",
              )}
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </ComposerSubmit>
          )}
        </ComposerActionGroup>
      </ComposerActions>
    </Composer>
  );
}
