"use client";

import { AppWindow } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { fmtFecha } from "@/lib/format";
import { avisarError, avisarOk, llamarApi } from "@/lib/settings/cliente";
import type { EstadoChrome } from "@/lib/settings/tipos";

function SesionBadge({ sesion }: { sesion: EstadoChrome["sesion"] }): React.ReactElement {
  if (sesion === "ok") return <Badge variant="success">sesión ok</Badge>;
  if (sesion === "no-disponible") return <Badge variant="error">sesión no disponible</Badge>;
  if (sesion === "desconocido") return <Badge variant="secondary">desconocido</Badge>;
  return <Badge variant="secondary">sin corridas</Badge>;
}

/** Pestaña Chrome / IG: cómo funciona la sesión de Instagram y estado de la última corrida. */
export function ChromePanel({ estado }: { estado: EstadoChrome }): React.ReactElement {
  const [abriendo, setAbriendo] = useState(false);

  const abrir = async () => {
    setAbriendo(true);
    try {
      await llamarApi("/api/ajustes/chrome/abrir", { method: "POST" });
      avisarOk("Chrome dedicado abierto", "Inicia sesión con la cuenta de la agencia si hace falta y cierra esa ventana antes de correr.");
    } catch (e) {
      avisarError("No se pudo abrir Chrome", (e as Error).message);
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-lg" id="ayuda">
        <CardHeader>
          <CardTitle className="t-label">Sesión de Instagram</CardTitle>
          <CardDescription className="text-fg-muted">
            El rastreo de Instagram usa el <strong>MCP chrome-devtools</strong> sobre un perfil de Chrome dedicado (distinto de tu Chrome
            personal). Inicia sesión una vez en ese perfil con la cuenta de la agencia. La cuenta es solo lectura: el rastreador jamás da like,
            sigue ni comenta.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm text-fg">
            <li>Pulsa «Abrir Instagram»: se abre el Chrome dedicado en instagram.com.</li>
            <li>Inicia sesión con la cuenta de la agencia (solo la primera vez o si caduca la sesión).</li>
            <li>Cierra esa ventana de Chrome: durante la corrida el agente lanza el perfil dedicado por su cuenta y no puede si ya está abierto.</li>
          </ol>
          <p className="text-xs text-fg-muted">
            Si Instagram pide un challenge o captcha, la corrida sigue solo con web (+Apify) y queda registrado como «sesión no disponible».
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button loading={abriendo} onClick={() => void abrir()}>
              <AppWindow aria-hidden="true" />
              Abrir Instagram
            </Button>
          </div>
        </CardPanel>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="t-label">Última corrida{estado.marca ? ` · ${estado.marca}` : ""}</CardTitle>
            <CardDescription className="text-fg-muted">
              {estado.corridaId ? (
                <>
                  {fmtFecha(estado.fecha)} ·{" "}
                  <Link className="font-mono text-xs underline-offset-2 hover:underline" href={`/corridas/${encodeURIComponent(estado.corridaId)}`}>
                    {estado.corridaId}
                  </Link>
                </>
              ) : (
                "La marca activa no tiene corridas todavía."
              )}
            </CardDescription>
          </div>
          <SesionBadge sesion={estado.sesion} />
        </CardHeader>
      </Card>
    </div>
  );
}
