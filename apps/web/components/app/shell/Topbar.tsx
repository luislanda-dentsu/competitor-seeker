"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ToastProvider } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandSwitcher } from "@/components/app/shell/BrandSwitcher";
import { GitSyncStatus } from "@/components/app/shell/GitSyncStatus";
import { MobileNav } from "@/components/app/shell/MobileNav";
import { NotificationCenter } from "@/components/app/shell/NotificationCenter";
import { usePageTitle } from "@/components/app/shell/PageTitle";
import { ThemeToggle } from "@/components/app/shell/ThemeToggle";
import { UserMenu } from "@/components/app/shell/UserMenu";

function TopbarTitle(): React.ReactElement {
  const title = usePageTitle();
  return <h1 className="t-page min-w-0 flex-1 truncate">{title}</h1>;
}

export function Topbar(): React.ReactElement {
  return (
    <header data-no-print className="mx-auto flex h-16 w-full max-w-[1680px] shrink-0 items-center gap-3 px-4 sm:px-6 lg:h-20 lg:px-8">
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
        <GitSyncStatus />

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

        <UserMenu />
      </div>
    </header>
  );
}
