"use client";

import { Gauge } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Hueco reservado para el medidor de uso de Apify (Fase Apify).
 * Hoy: placeholder "Apify sin configurar" con enlace a Ajustes.
 */
export function UsageMeter({
  collapsed = false,
  collapsible = true,
  className,
}: {
  collapsed?: boolean;
  /** false en el Sheet móvil: ignora el estado colapsado del sidebar. */
  collapsible?: boolean;
  className?: string;
}): React.ReactElement {
  const link = (
    <Link
      className={cn(
        "flex items-center gap-2.5 rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-fg-muted transition-colors hover:bg-card-2/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
        collapsible &&
          "sb-collapsed:justify-center sb-collapsed:border-transparent sb-collapsed:px-0",
        className,
      )}
      href="/ajustes"
    >
      <Gauge aria-hidden="true" className="size-[18px] shrink-0" />
      <span
        className={cn(
          "flex min-w-0 flex-col",
          collapsible && "sb-collapsed:sr-only",
        )}
      >
        <span className="t-label">Uso de Apify</span>
        <span className="truncate">Apify sin configurar</span>
      </span>
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipPopup side="right">Apify sin configurar · ir a Ajustes</TooltipPopup>
    </Tooltip>
  );
}
