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
                onClick={() => setTheme(value)}
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
