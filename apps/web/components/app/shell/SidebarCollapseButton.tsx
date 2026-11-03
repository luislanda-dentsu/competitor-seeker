"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

export function SidebarCollapseButton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  const { collapsed, toggle } = useSidebar();
  const label = collapsed ? "Expandir barra lateral" : "Colapsar barra lateral";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={collapsed}
            className={cn("text-fg-muted", className)}
            onClick={toggle}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <PanelLeftClose aria-hidden="true" className="sb-collapsed:hidden" />
        <PanelLeftOpen
          aria-hidden="true"
          className="hidden sb-collapsed:block"
        />
      </TooltipTrigger>
      <TooltipPopup side="right">{label}</TooltipPopup>
    </Tooltip>
  );
}
