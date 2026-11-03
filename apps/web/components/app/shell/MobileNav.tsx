"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/app/shell/SidebarNav";
import { ThemeToggle } from "@/components/app/shell/ThemeToggle";
import { UsageMeter } from "@/components/app/shell/UsageMeter";

/** En <1024px: hamburguesa que abre un Sheet con la misma navegación. */
export function MobileNav(): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        render={
          <Button
            aria-label="Abrir navegación"
            className="text-fg-muted lg:hidden"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <Menu aria-hidden="true" />
      </SheetTrigger>
      <SheetPopup className="bg-surface" side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-md bg-primary font-mono text-[13px] font-semibold text-primary-fg"
            >
              cs
            </span>
            Competitor-Seeker
          </SheetTitle>
          <SheetDescription>Navegación</SheetDescription>
        </SheetHeader>
        <SheetPanel className="flex flex-col gap-3">
          <SidebarNav collapsible={false} onNavigate={() => setOpen(false)} />
          <UsageMeter collapsible={false} />
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <Link
              className="text-sm text-fg-muted hover:text-fg"
              href="/ajustes#ayuda"
              onClick={() => setOpen(false)}
            >
              Ayuda
            </Link>
            <ThemeToggle />
          </div>
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
