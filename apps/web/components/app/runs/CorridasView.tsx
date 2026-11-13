"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import FadeContent from "@/components/bits/FadeContent";
import { ConfirmDialog, type ResultadoConfirmacion } from "@/components/app/runs/ConfirmDialog";
import { RunConsoleView, useCronometro } from "@/components/app/runs/RunConsole";
import { RunLauncher } from "@/components/app/runs/RunLauncher";
import { RunSummary } from "@/components/app/runs/RunSummary";
import type { ResumenFin } from "@/lib/runs/consola";
import { rutaApiCorrida, type ApifyUi, type CorridaActiva, type LanzarHistorica, type MarcaUi } from "@/lib/runs/tipos";
import { useCorridaStream } from "@/lib/use-sse";

export interface CorridasViewProps {
  marcas: readonly MarcaUi[];
  marcaInicial: string;
  apify: ApifyUi;
  /** Corrida en curso al cargar (lock vivo): se reconecta a su stream. */
  enCurso: CorridaActiva | null;
}

function fechaDeId(id: string, inicio: string): string {
  return /^\d{4}-\d{2}-\d{2}/.exec(id)?.[0] ?? inicio.slice(0, 10);
}

/** Consola viva + resumen + diálogo de confirmación para una corrida. */
function ConsolaActiva({
  activa,
  onCerrada,
}: {
  activa: CorridaActiva;
  onCerrada: (fin: ResumenFin) => void;
}): React.ReactElement {
  const { consola, conexion, error: errorStream } = useCorridaStream(activa.marca, activa.corridaId);
  const fin = consola.fin;
  const tiempo = useCronometro(activa.inicio, fin?.duracionMs, fin === null);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);
  const avisado = useRef(false);

  useEffect(() => {
    if (fin && !avisado.current) {
      avisado.current = true;
      onCerrada(fin);
    }
  }, [fin, onCerrada]);

  const cancelar = async () => {
    setCancelando(true);
    setErrorCancelar(null);
    try {
      const res = await fetch(rutaApiCorrida(activa.marca, activa.corridaId), { method: "DELETE" });
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(cuerpo.error ?? `Error ${res.status}`);
      }
    } catch (e) {
      setErrorCancelar((e as Error).message);
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <RunConsoleView
        cancelando={cancelando}
        conexion={conexion}
        consola={consola}
        fecha={fechaDeId(activa.corridaId, activa.inicio)}
        marca={activa.marca}
        onCancelar={() => void cancelar()}
        tiempo={tiempo}
      />
      {errorStream && (
        <p className="text-sm text-s-no-funciona" role="alert">
          {errorStream}
        </p>
      )}
      {errorCancelar && (
        <p className="text-sm text-s-no-funciona" role="alert">
          No se pudo cancelar: {errorCancelar}
        </p>
      )}
    </div>
  );
}

export function CorridasView({ marcas, marcaInicial, apify, enCurso }: CorridasViewProps): React.ReactElement {
  const router = useRouter();
  const [activa, setActiva] = useState<CorridaActiva | null>(enCurso);
  const [fin, setFin] = useState<ResumenFin | null>(null);
  const [lanzando, setLanzando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; enCurso?: CorridaActiva } | null>(null);
  const [dialogo, setDialogo] = useState(false);

  const lanzar = async (marca: string, incluirApify: boolean, historica?: LanzarHistorica) => {
    setLanzando(true);
    setError(null);
    setFin(null);
    try {
      const res = await fetch("/api/corridas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marca, incluirApify, ...(historica ? { ventana: historica.ventana, topePosts: historica.topePosts } : {}) }),
      });
      const cuerpo = (await res.json().catch(() => ({}))) as Partial<CorridaActiva> & { error?: string; enCurso?: CorridaActiva };
      if (res.status === 409) {
        setError({ mensaje: cuerpo.error ?? "Ya hay una corrida en curso.", enCurso: cuerpo.enCurso });
        return;
      }
      if (!res.ok || !cuerpo.corridaId || !cuerpo.marca || !cuerpo.inicio) {
        setError({ mensaje: cuerpo.error ?? `Error ${res.status}` });
        return;
      }
      setActiva({ corridaId: cuerpo.corridaId, marca: cuerpo.marca, inicio: cuerpo.inicio });
    } catch (e) {
      setError({ mensaje: (e as Error).message });
    } finally {
      setLanzando(false);
    }
  };

  const alCerrar = useCallback(
    (f: ResumenFin) => {
      setFin(f);
      if (f.estado === "pendiente-confirmacion") setDialogo(true);
      router.refresh();
    },
    [router],
  );

  const alResolver = (r: ResultadoConfirmacion) => {
    setFin((prev) => (prev ? { ...prev, estado: r.estado } : prev));
    router.refresh();
  };

  const ocupado = activa !== null && fin === null;

  return (
    <div className="flex flex-col gap-4">
      <RunLauncher apify={apify} lanzando={lanzando} marcaInicial={marcaInicial} marcas={marcas} ocupado={ocupado} onLanzar={(m, a, h) => void lanzar(m, a, h)} />

      {error && (
        <Alert variant="error">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>No se lanzó la corrida</AlertTitle>
          <AlertDescription>{error.mensaje}</AlertDescription>
          {error.enCurso && (
            <AlertAction>
              <Button
                onClick={() => {
                  setActiva(error.enCurso!);
                  setFin(null);
                  setError(null);
                }}
                size="sm"
                variant="outline"
              >
                Ver consola
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}

      {activa && (
        <FadeContent duration={0.5} trigger="mount">
          <ConsolaActiva activa={activa} key={activa.corridaId} onCerrada={alCerrar} />
        </FadeContent>
      )}

      {fin && <RunSummary fin={fin} onRevisar={() => setDialogo(true)} />}

      {activa && fin && (
        <ConfirmDialog
          corridaId={activa.corridaId}
          intentos={fin.intentos ?? 0}
          marca={activa.marca}
          objeciones={fin.objeciones ?? []}
          onOpenChange={setDialogo}
          onResuelto={alResolver}
          open={dialogo && fin.estado === "pendiente-confirmacion"}
        />
      )}
    </div>
  );
}
