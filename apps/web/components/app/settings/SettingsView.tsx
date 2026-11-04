"use client";

import { AppWindow, Building2, Gauge, KeyRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { ApifyPanel } from "@/components/app/settings/ApifyPanel";
import { BrandsPanel } from "@/components/app/settings/BrandsPanel";
import { BudgetPanel } from "@/components/app/settings/BudgetPanel";
import { ChromePanel } from "@/components/app/settings/ChromePanel";
import { CompetitorsPanel } from "@/components/app/settings/CompetitorsPanel";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { DatosAjustes } from "@/lib/settings/tipos";

export const PESTANAS = [
  { value: "marcas", label: "Marcas", icon: Building2 },
  { value: "competidores", label: "Competidores", icon: Users },
  { value: "apify", label: "Apify", icon: KeyRound },
  { value: "presupuestos", label: "Presupuestos", icon: Gauge },
  { value: "chrome", label: "Chrome / IG", icon: AppWindow },
] as const;

export type Pestana = (typeof PESTANAS)[number]["value"];

function pestanaDesdeHash(hash: string): Pestana | null {
  const h = hash.replace(/^#/, "");
  if (h === "ayuda") return "chrome";
  return PESTANAS.some((p) => p.value === h) ? (h as Pestana) : null;
}

/** Ajustes: Tabs verticales (horizontales en móvil). `#apify`, `#presupuestos`… abren la pestaña. */
export function SettingsView({ datos }: { datos: DatosAjustes }): React.ReactElement {
  const [pestana, setPestana] = useState<Pestana>("marcas");
  const estrecho = useMediaQuery("max-md");

  useEffect(() => {
    const aplicar = () => {
      const p = pestanaDesdeHash(window.location.hash);
      if (p) setPestana(p);
    };
    aplicar();
    window.addEventListener("hashchange", aplicar);
    return () => window.removeEventListener("hashchange", aplicar);
  }, []);

  const cambiar = (v: unknown) => {
    if (typeof v !== "string") return;
    setPestana(v as Pestana);
    window.history.replaceState(null, "", `#${v}`);
  };

  return (
    <Tabs className="gap-4 md:gap-6" onValueChange={cambiar} orientation={estrecho ? "horizontal" : "vertical"} value={pestana}>
      <TabsList
        aria-label="Secciones de ajustes"
        className="w-full shrink-0 overflow-x-auto md:w-52 md:items-stretch"
        variant="underline"
      >
        {PESTANAS.map((p) => (
          <TabsTab className="justify-start gap-2 px-2.5 text-fg-muted data-active:text-fg" key={p.value} value={p.value}>
            <p.icon aria-hidden="true" className="size-4 shrink-0" />
            {p.label}
          </TabsTab>
        ))}
      </TabsList>
      <TabsPanel value="marcas">
        <BrandsPanel activa={datos.activa} marcas={datos.marcas} />
      </TabsPanel>
      <TabsPanel value="competidores">
        <CompetitorsPanel
          competidores={datos.competidores}
          key={datos.activa ?? "sin-marca"}
          marca={datos.marcas.find((m) => m.slug === datos.activa) ?? null}
        />
      </TabsPanel>
      <TabsPanel value="apify">
        <ApifyPanel token={datos.token} />
      </TabsPanel>
      <TabsPanel value="presupuestos">
        <BudgetPanel config={datos.config} />
      </TabsPanel>
      <TabsPanel value="chrome">
        <ChromePanel estado={datos.chrome} />
      </TabsPanel>
    </Tabs>
  );
}
