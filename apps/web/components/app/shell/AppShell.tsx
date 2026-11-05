import { Suspense, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageTitleProvider } from "@/components/app/shell/PageTitle";
import { SectionScope } from "@/components/app/shell/SectionScope";
import { Sidebar } from "@/components/app/shell/Sidebar";
import { Topbar } from "@/components/app/shell/Topbar";
import { cargarContextoMarca } from "@/lib/brand";
import { BrandProvider } from "@/lib/brand-context";

/**
 * Estilo AMGC (Orbit): fondo #010101 a sangre; el sidebar es una tarjeta
 * flotante (m-2, radio 14) y el contenido son tarjetas separadas por el
 * hueco de fondo. En <lg el sidebar se sustituye por el Sheet de MobileNav.
 *
 * El contexto de marca (cookie + marca.json) se pasa como PROMESA sin
 * esperar: BrandSwitcher y el sub-menú de competidores la resuelven con
 * `use()` dentro de su propio Suspense (Cache Components).
 */
export function AppShell({ children }: { children: ReactNode }): React.ReactElement {
  const contextoMarca = cargarContextoMarca();
  return (
    <TooltipProvider delay={300}>
      <BrandProvider promise={contextoMarca}>
      <PageTitleProvider>
        <Suspense fallback={null}>
          <SectionScope />
        </Suspense>
        <div className="min-h-dvh bg-canvas">
          <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)] lg:sb-collapsed:grid-cols-[76px_minmax(0,1fr)]">
            <Sidebar />
            <div className="flex min-w-0 flex-col">
              <Topbar />
              <main className="mx-auto w-full min-w-0 max-w-[1680px] flex-1 px-4 pt-2 pb-6 sm:px-6 lg:px-8" id="contenido">
                {children}
              </main>
            </div>
          </div>
        </div>
      </PageTitleProvider>
      </BrandProvider>
    </TooltipProvider>
  );
}
