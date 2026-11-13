"use client";

import { History, Play } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmHistoricaDialog, fmtUsd, useEstimacionHistorica, VentanaFields } from "@/components/app/runs/HistoricaLauncher";
import { Button } from "@/components/ui/button";
import { GitSyncStatus } from "@/components/app/shell/GitSyncStatus";
import { Card, CardPanel } from "@/components/ui/card";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ApifyUi, LanzarHistorica, MarcaUi, VentanaUi } from "@/lib/runs/tipos";

/** Ayer en hora local (`AAAA-MM-DD`): una ventana histórica termina antes de hoy. */
function ayerLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface RunLauncherProps {
  marcas: readonly MarcaUi[];
  marcaInicial: string;
  apify: ApifyUi;
  /** Hay una corrida en curso: no se puede lanzar otra. */
  ocupado: boolean;
  lanzando: boolean;
  onLanzar: (marca: string, incluirApify: boolean, historica?: LanzarHistorica) => void;
}

/** Marca · nº de competidores · periodo pasado (opcional) · Switch Apify con estimación · estado git · "Correr ahora". */
export function RunLauncher({ marcas, marcaInicial, apify, ocupado, lanzando, onLanzar }: RunLauncherProps): React.ReactElement {
  const [marca, setMarca] = useState(marcaInicial);
  const [incluirApify, setIncluirApify] = useState(false);
  const [historica, setHistorica] = useState(false);
  const [ventana, setVentana] = useState<VentanaUi>({ desde: "", hasta: "" });
  const [confirmar, setConfirmar] = useState(false);
  const idApify = useId();
  const idHistorica = useId();
  const seleccionada = marcas.find((m) => m.slug === marca) ?? marcas[0];
  const items = marcas.map((m) => ({ label: m.nombre, value: m.slug }));
  const sinCompetidores = !seleccionada || seleccionada.competidores === 0;
  const conApify = incluirApify && apify.disponible;
  const est = useEstimacionHistorica(seleccionada?.slug, ventana, historica);
  const estimado = historica
    ? (est.estimacion?.costeEstimadoUsd ?? 0)
    : seleccionada
      ? Math.round(apify.resultsLimit * seleccionada.perfilesIg * apify.usdPorResultado * 100) / 100
      : 0;
  const historicaLista = !historica || (est.estimacion !== null && !est.error);
  const pistaApify = historica
    ? est.estimacion
      ? `≈ ${est.estimacion.postsEstimados} posts en ${est.estimacion.dias} días · máx. ${fmtUsd(est.estimacion.costeMaximoUsd)} (${est.estimacion.topePosts} posts)`
      : (est.error ?? (est.cargando ? "Calculando…" : "Elige la ventana para ver el coste."))
    : `${apify.resultsLimit} posts × ${seleccionada?.perfilesIg ?? 0} perfiles IG × $${apify.usdPorResultado}`;

  const lanzar = () => {
    if (!seleccionada) return;
    if (historica) {
      setConfirmar(true);
      return;
    }
    onLanzar(seleccionada.slug, conApify);
  };

  return (
    <Card>
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
            <span className="t-label">Periodo</span>
            <label className="flex h-8 items-center gap-2.5 text-sm" htmlFor={idHistorica}>
              <Switch checked={historica} disabled={ocupado || lanzando} id={idHistorica} onCheckedChange={(v) => setHistorica(v)} />
              <span className="text-fg">Periodo pasado</span>
            </label>
            {historica ? (
              <VentanaFields disabled={ocupado || lanzando} max={ayerLocal()} onChange={setVentana} ventana={ventana} />
            ) : (
              <span className="text-xs text-fg-muted">Desde la última corrida hasta hoy.</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="t-label">Apify</span>
            <label className="flex h-8 items-center gap-2.5 text-sm" htmlFor={idApify}>
              <Switch
                aria-describedby={`${idApify}-hint`}
                checked={incluirApify && apify.disponible}
                disabled={!apify.disponible || ocupado || lanzando}
                id={idApify}
                onCheckedChange={(v) => setIncluirApify(v)}
              />
              <span className="text-fg">Incluir Apify</span>
              {apify.disponible && (!historica || est.estimacion) && (
                <span className="font-mono text-xs tabular-nums text-fg-muted">
                  est. {fmtUsd(estimado)}
                </span>
              )}
            </label>
            <span className="text-xs text-fg-muted" id={`${idApify}-hint`}>
              {apify.disponible
                ? pistaApify
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
            <Button disabled={ocupado || sinCompetidores || !seleccionada || !historicaLista} loading={lanzando && !confirmar} onClick={lanzar} size="lg">
              {historica ? <History aria-hidden="true" /> : <Play aria-hidden="true" />}
              {historica ? "Correr periodo pasado" : "Correr ahora"}
            </Button>
            {ocupado && <span className="text-xs text-fg-muted">Hay una corrida en curso.</span>}
            {!ocupado && sinCompetidores && <span className="text-xs text-fg-muted">La marca no tiene competidores activos.</span>}
          </div>
        </div>
      </CardPanel>
      {seleccionada && (
        <ConfirmHistoricaDialog
          conApify={conApify}
          estimacion={est.estimacion}
          lanzando={lanzando}
          marcaNombre={seleccionada.nombre}
          onConfirmar={() => {
            onLanzar(seleccionada.slug, conApify, { ventana, topePosts: est.estimacion?.topePosts ?? 0 });
            setConfirmar(false);
          }}
          onOpenChange={setConfirmar}
          open={confirmar}
          ventana={ventana}
        />
      )}
    </Card>
  );
}
