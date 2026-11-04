"use client";

import { Play } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { GitSyncStatus } from "@/components/app/shell/GitSyncStatus";
import { Card, CardPanel } from "@/components/ui/card";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ApifyUi, MarcaUi } from "@/lib/runs/tipos";

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export interface RunLauncherProps {
  marcas: readonly MarcaUi[];
  marcaInicial: string;
  apify: ApifyUi;
  /** Hay una corrida en curso: no se puede lanzar otra. */
  ocupado: boolean;
  lanzando: boolean;
  onLanzar: (marca: string, incluirApify: boolean) => void;
}

/** Marca · nº de competidores · Switch Apify con estimación · estado git · "Correr ahora". */
export function RunLauncher({ marcas, marcaInicial, apify, ocupado, lanzando, onLanzar }: RunLauncherProps): React.ReactElement {
  const [marca, setMarca] = useState(marcaInicial);
  const [incluirApify, setIncluirApify] = useState(false);
  const idApify = useId();
  const seleccionada = marcas.find((m) => m.slug === marca) ?? marcas[0];
  const items = marcas.map((m) => ({ label: m.nombre, value: m.slug }));
  const estimado = seleccionada ? Math.round(apify.resultsLimit * seleccionada.perfilesIg * apify.usdPorResultado * 100) / 100 : 0;
  const sinCompetidores = !seleccionada || seleccionada.competidores === 0;

  return (
    <Card className="rounded-lg">
      <CardPanel className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
          <div className="flex min-w-0 flex-col gap-1.5 lg:w-72">
            <span className="t-label">Marca</span>
            <Select items={items} onValueChange={(v) => typeof v === "string" && setMarca(v)} value={marca}>
              <SelectTrigger aria-label="Marca de la corrida">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {items.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <span className="text-xs text-fg-muted">
              {seleccionada ? (
                <>
                  <span className="font-mono tabular-nums text-fg">{seleccionada.competidores}</span>{" "}
                  {seleccionada.competidores === 1 ? "competidor activo" : "competidores activos"}
                  {seleccionada.perfilesIg > 0 && <> · {seleccionada.perfilesIg} con Instagram</>}
                </>
              ) : (
                "sin marca"
              )}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="t-label">Apify</span>
            <label className="flex h-8 items-center gap-2.5 text-sm" htmlFor={idApify}>
              <Switch
                aria-describedby={`${idApify}-hint`}
                checked={incluirApify && apify.disponible}
                disabled={!apify.disponible || ocupado}
                id={idApify}
                onCheckedChange={(v) => setIncluirApify(v)}
              />
              <span className="text-fg">Incluir Apify</span>
              {apify.disponible && (
                <span className="font-mono text-xs tabular-nums text-fg-muted">
                  est. {fmtUsd(estimado)}
                </span>
              )}
            </label>
            <span className="text-xs text-fg-muted" id={`${idApify}-hint`}>
              {apify.disponible
                ? `${apify.resultsLimit} posts × ${seleccionada?.perfilesIg ?? 0} perfiles IG × $${apify.usdPorResultado}`
                : apify.motivo === "sin token"
                  ? "Sin token de Apify: configúralo en Ajustes para habilitar las métricas de Instagram."
                  : `Apify no disponible (${apify.motivo ?? "sin motivo"}).`}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="t-label">Git</span>
            <div className="flex h-8 items-center">
              <GitSyncStatus compacto />
            </div>
            <span className="text-xs text-fg-muted">Se sincroniza antes y después de cada corrida.</span>
          </div>

          <div className="flex flex-col gap-1.5 lg:ms-auto">
            <Button disabled={ocupado || sinCompetidores || !seleccionada} loading={lanzando} onClick={() => seleccionada && onLanzar(seleccionada.slug, incluirApify && apify.disponible)} size="lg">
              <Play aria-hidden="true" />
              Correr ahora
            </Button>
            {ocupado && <span className="text-xs text-fg-muted">Hay una corrida en curso.</span>}
            {!ocupado && sinCompetidores && <span className="text-xs text-fg-muted">La marca no tiene competidores activos.</span>}
          </div>
        </div>
      </CardPanel>
    </Card>
  );
}
