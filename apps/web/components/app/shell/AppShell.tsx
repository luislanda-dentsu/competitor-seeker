import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageTitleProvider } from "@/components/app/shell/PageTitle";
import { Sidebar } from "@/components/app/shell/Sidebar";
import { Topbar } from "@/components/app/shell/Topbar";

/**
 * Canvas (gris) con padding → contenedor surface radio 24 → sidebar + main.
 * En <lg el contenedor va a sangre (sin radio ni padding) y el sidebar se
 * sustituye por el Sheet de MobileNav.
 */
export function AppShell({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <TooltipProvider delay={300}>
      <PageTitleProvider>
        <div className="min-h-dvh bg-canvas lg:p-4">
          <div className="grid min-h-dvh grid-cols-1 overflow-clip bg-surface lg:min-h-[calc(100dvh-2rem)] lg:grid-cols-[64px_minmax(0,1fr)] lg:rounded-[24px] lg:border lg:border-border lg:shadow-xs xl:grid-cols-[240px_minmax(0,1fr)] xl:sb-collapsed:grid-cols-[64px_minmax(0,1fr)]">
            <Sidebar />
            <div className="flex min-w-0 flex-col">
              <Topbar />
              <main className="min-w-0 flex-1 p-4 lg:p-6" id="contenido">
                {children}
              </main>
            </div>
          </div>
        </div>
      </PageTitleProvider>
    </TooltipProvider>
  );
}
