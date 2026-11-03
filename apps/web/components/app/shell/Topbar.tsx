"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastProvider } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandSwitcher } from "@/components/app/shell/BrandSwitcher";
import { MobileNav } from "@/components/app/shell/MobileNav";
import { NotificationCenter } from "@/components/app/shell/NotificationCenter";
import { usePageTitle } from "@/components/app/shell/PageTitle";
import { ThemeToggle } from "@/components/app/shell/ThemeToggle";

const PERIODOS = [
  { value: "3", label: "Últimas 3 corridas" },
  { value: "5", label: "Últimas 5 corridas" },
  { value: "10", label: "Últimas 10 corridas" },
  { value: "todas", label: "Todas las corridas" },
];

function TopbarTitle(): React.ReactElement {
  const title = usePageTitle();
  return <h1 className="t-page min-w-0 flex-1 truncate">{title}</h1>;
}

export function Topbar(): React.ReactElement {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 lg:px-6">
      <MobileNav />
      {/* usePathname es dato de runtime en rutas dinámicas: va en Suspense */}
      <Suspense
        fallback={
          <h1 aria-busy="true" className="t-page min-w-0 flex-1 truncate">
            <span className="sr-only">Cargando título</span>
          </h1>
        }
      >
        <TopbarTitle />
      </Suspense>

      <div className="flex items-center gap-2">
        {/* Período (sin lógica aún) */}
        <Select defaultValue="3" items={PERIODOS}>
          <SelectTrigger
            aria-label="Período"
            className="hidden h-8 min-h-8 min-w-0 rounded-pill border-transparent bg-card-2 text-fg shadow-none sm:h-8 md:inline-flex"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {PERIODOS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        <BrandSwitcher />

        {/* Notificaciones (campana + viewport de toasts: el toastManager es global) */}
        <ToastProvider position="bottom-right">
          <NotificationCenter />
        </ToastProvider>

        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Paleta de comandos (⌘K)"
                className="hidden text-fg-muted lg:inline-flex"
                size="sm"
                variant="ghost"
              />
            }
          >
            <Kbd>⌘K</Kbd>
          </TooltipTrigger>
          <TooltipPopup>Paleta de comandos · próximamente</TooltipPopup>
        </Tooltip>
      </div>
    </header>
  );
}
