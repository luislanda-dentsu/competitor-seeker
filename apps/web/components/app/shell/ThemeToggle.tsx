"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme, type ThemePref } from "@/lib/theme";

const OPTIONS: readonly { value: ThemePref; label: string; Icon: typeof Sun }[] =
  [
    { value: "light", label: "Claro", Icon: Sun },
    { value: "dark", label: "Oscuro", Icon: Moon },
    { value: "system", label: "Sistema", Icon: Monitor },
  ];

/**
 * Cambio de tema con barrido circular desde el clic (View Transitions, como Orbit):
 * 520 ms, cubic-bezier(0.65, 0, 0.35, 1). Sin soporte o con reduced-motion, cambia sin animar.
 */
function cambiarConBarrido(aplicar: () => void, x: number, y: number): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    aplicar();
    return;
  }
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = doc.startViewTransition(aplicar);
  t.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      /* transición saltada (pestaña oculta u otra en curso): el tema ya se aplicó */
    });
}

export function ThemeToggle(): React.ReactElement {
  const { pref, setTheme } = useTheme();
  return (
    <SegmentedControl aria-label="Tema" size="sm" role="radiogroup">
      {OPTIONS.map(({ value, label, Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger
            render={
              <SegmentedControlItem
                aria-checked={pref === value}
                aria-label={label}
                data-checked={pref === value ? "" : undefined}
                onClick={(e) => cambiarConBarrido(() => setTheme(value), e.clientX, e.clientY)}
                role="radio"
              />
            }
          >
            <Icon aria-hidden="true" />
          </TooltipTrigger>
          <TooltipPopup>{label}</TooltipPopup>
        </Tooltip>
      ))}
    </SegmentedControl>
  );
}
