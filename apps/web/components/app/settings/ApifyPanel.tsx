"use client";

import { Eye, EyeOff, KeyRound, PlugZap, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { fmtFecha } from "@/lib/format";
import { avisarError, avisarOk, llamarApi } from "@/lib/settings/cliente";
import type { EstadoToken } from "@/lib/settings/tipos";
import { CuerpoToken, primerError } from "@/lib/settings/validacion";

/** Campo de token tipo password con mostrar/ocultar. */
export function ApifyTokenField({
  value,
  onChange,
  error,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  id: string;
}): React.ReactElement {
  const [visible, setVisible] = useState(false);
  return (
    <Field className="w-full" invalid={error !== null} name="token">
      <FieldLabel htmlFor={id}>Token de API de Apify</FieldLabel>
      <span className="flex w-full items-center gap-2">
        <Input
          autoComplete="off"
          className="font-mono"
          id={id}
          onChange={(e) => onChange(e.target.value)}
          placeholder="apify_api_…"
          spellCheck={false}
          type={visible ? "text" : "password"}
          value={value}
        />
        <Button aria-label={visible ? "Ocultar token" : "Mostrar token"} aria-pressed={visible} onClick={() => setVisible((v) => !v)} size="icon" type="button" variant="outline">
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </span>
      <FieldDescription>
        Se guarda en <code>data/secrets.json</code> (modo 600), ignorado por git. Nunca se devuelve completo a la interfaz.
      </FieldDescription>
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}

interface ResultadoPrueba {
  ok: boolean;
  ciclo?: { inicio: string; fin: string };
  mensual?: { usadoUsd: number; limiteUsd: number };
  error?: string;
}

/** Pestaña Apify: token (guardar / probar / quitar). */
export function ApifyPanel({ token: inicial }: { token: EstadoToken }): React.ReactElement {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoToken>(inicial);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null);
  const id = useId();

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = CuerpoToken.safeParse({ token });
    if (!res.success) {
      setError(primerError(res.error));
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const r = await llamarApi<EstadoToken>("/api/ajustes/apify", { method: "PUT", body: res.data });
      setEstado(r);
      setToken("");
      setPrueba(null);
      avisarOk("Token guardado", `Apify configurado (····${r.ultimos4}). Prueba la conexión para comprobarlo.`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const probar = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      const r = await fetch("/api/ajustes/apify/probar", { method: "POST" });
      const cuerpo = (await r.json().catch(() => ({}))) as ResultadoPrueba;
      if (cuerpo.ok) {
        setPrueba(cuerpo);
        avisarOk("Conexión correcta", `Ciclo hasta ${fmtFecha(cuerpo.ciclo?.fin.slice(0, 10))} · $${cuerpo.mensual?.usadoUsd.toFixed(2)} de $${cuerpo.mensual?.limiteUsd.toFixed(2)}.`);
        router.refresh();
      } else {
        const msg = cuerpo.error ?? `Error ${r.status}`;
        setPrueba({ ok: false, error: msg });
        avisarError("La prueba falló", msg);
      }
    } catch (err) {
      const msg = (err as Error).message;
      setPrueba({ ok: false, error: msg });
      avisarError("La prueba falló", msg);
    } finally {
      setProbando(false);
    }
  };

  const quitar = async () => {
    setQuitando(true);
    try {
      const r = await llamarApi<EstadoToken>("/api/ajustes/apify", { method: "DELETE" });
      setEstado(r);
      setPrueba(null);
      avisarOk("Token eliminado", r.configurado ? "Sigue activo el de la variable APIFY_TOKEN." : "Apify queda sin configurar.");
      router.refresh();
    } catch (err) {
      avisarError("No se pudo quitar el token", (err as Error).message);
    } finally {
      setQuitando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="t-label">Apify</CardTitle>
          <CardDescription className="text-fg-muted">
            Métricas numéricas de Instagram vía <code>apify/instagram-scraper</code> (free tier $5/mes, ≈$0.0027 por resultado).
          </CardDescription>
        </div>
        {estado.configurado ? (
          <Badge className="shrink-0 font-mono" variant="success">
            <KeyRound aria-hidden="true" />
            configurado · ····{estado.ultimos4}
            {estado.desdeEntorno && <span className="font-sans"> (entorno)</span>}
          </Badge>
        ) : (
          <Badge className="shrink-0" variant="warning">
            sin configurar
          </Badge>
        )}
      </CardHeader>
      <CardPanel className="flex flex-col gap-5">
        <Form className="flex flex-col gap-4" onSubmit={(e) => void guardar(e)}>
          <ApifyTokenField
            error={error}
            id={id}
            onChange={(v) => {
              setToken(v);
              setError(null);
            }}
            value={token}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={token.trim() === ""} loading={guardando} type="submit">
              <Save aria-hidden="true" />
              Guardar
            </Button>
            <Button disabled={!estado.configurado} loading={probando} onClick={() => void probar()} type="button" variant="outline">
              <PlugZap aria-hidden="true" />
              Probar conexión
            </Button>
            {estado.configurado && !estado.desdeEntorno && (
              <Button className="ms-auto" loading={quitando} onClick={() => void quitar()} type="button" variant="ghost">
                <Trash2 aria-hidden="true" />
                Quitar token
              </Button>
            )}
          </div>
        </Form>
        {prueba && (
          <div
            className={prueba.ok ? "rounded-md bg-s-nuevo-soft px-3 py-2 text-sm text-s-nuevo" : "rounded-md bg-s-no-funciona-soft px-3 py-2 text-sm text-s-no-funciona"}
            role="status"
          >
            {prueba.ok && prueba.ciclo && prueba.mensual ? (
              <>
                Conexión correcta. Ciclo {fmtFecha(prueba.ciclo.inicio.slice(0, 10))} → {fmtFecha(prueba.ciclo.fin.slice(0, 10))} · usado{" "}
                <span className="font-mono tabular-nums">${prueba.mensual.usadoUsd.toFixed(2)}</span> de{" "}
                <span className="font-mono tabular-nums">${prueba.mensual.limiteUsd.toFixed(2)}</span>.
              </>
            ) : (
              prueba.error
            )}
          </div>
        )}
      </CardPanel>
    </Card>
  );
}
