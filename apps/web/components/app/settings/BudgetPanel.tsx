"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { ConfigApify } from "@competitor-seeker/core/schemas/config";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { UsageMeter } from "@/components/app/shell/UsageMeter";
import { avisarError, avisarOk, llamarApi } from "@/lib/settings/cliente";
import { ConfigApifyForm, primerError } from "@/lib/settings/validacion";

function CampoUsd({
  etiqueta,
  descripcion,
  value,
  onChange,
}: {
  etiqueta: string;
  descripcion: string;
  value: number | null;
  onChange: (v: number | null) => void;
}): React.ReactElement {
  const id = useId();
  return (
    <Field className="w-full" name={etiqueta}>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <NumberField
        format={{ style: "currency", currency: "USD", minimumFractionDigits: 2 }}
        id={id}
        min={0}
        onValueChange={(v) => onChange(v ?? null)}
        step={0.5}
        value={value}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label="Reducir" />
          <NumberFieldInput placeholder="auto" />
          <NumberFieldIncrement aria-label="Aumentar" />
        </NumberFieldGroup>
      </NumberField>
      <FieldDescription>{descripcion}</FieldDescription>
    </Field>
  );
}

function CampoEntero({
  etiqueta,
  descripcion,
  value,
  onChange,
  min,
  max,
  sufijo,
}: {
  etiqueta: string;
  descripcion?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  sufijo?: string;
}): React.ReactElement {
  const id = useId();
  return (
    <Field className="w-full" name={etiqueta}>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <NumberField id={id} max={max} min={min} onValueChange={(v) => v !== null && onChange(v)} step={1} value={value}>
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label="Reducir" />
          <NumberFieldInput />
          <NumberFieldIncrement aria-label="Aumentar" />
        </NumberFieldGroup>
      </NumberField>
      {(descripcion || sufijo) && <FieldDescription>{descripcion ?? sufijo}</FieldDescription>}
    </Field>
  );
}

/** Pestaña Presupuestos: `config.json › apify` + vista previa del medidor. */
export function BudgetPanel({ config }: { config: ConfigApify }): React.ReactElement {
  const router = useRouter();
  const [form, setForm] = useState<ConfigApify>(config);
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);
  const idPausar = useId();
  const idHabilitado = useId();
  const pausarAl100 = form.saltarSiPctMensual >= 100;
  const umbrales: [number, number, number] = [form.umbrales[0] ?? 70, form.umbrales[1] ?? 90, form.umbrales[2] ?? 100];

  const setPresupuesto = (clave: keyof ConfigApify["presupuesto"], v: number | null) =>
    setForm((f) => ({ ...f, presupuesto: { ...f.presupuesto, [clave]: v } }));
  const setUmbral = (i: 0 | 1 | 2, v: number) =>
    setForm((f) => {
      const u = [...umbrales] as [number, number, number];
      u[i] = v;
      return { ...f, umbrales: u };
    });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = ConfigApifyForm.safeParse(form);
    if (!res.success) {
      avisarError("Revisa los valores", primerError(res.error));
      return;
    }
    setGuardando(true);
    try {
      const r = await llamarApi<{ apify: ConfigApify }>("/api/ajustes/config", { method: "PUT", body: { apify: res.data } });
      setForm(r.apify);
      setVersion((v) => v + 1);
      avisarOk("Presupuestos guardados", "config.json se sincroniza por git con la otra Mac.");
      router.refresh();
    } catch (err) {
      avisarError("No se pudo guardar", (err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="t-label">Presupuestos y umbrales</CardTitle>
          <CardDescription className="text-fg-muted">
            En blanco («auto») el mensual se toma del límite que reporta Apify; el diario es mensual ÷ días del ciclo y el semanal, diario × 7.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          <Form className="flex flex-col gap-6" onSubmit={(e) => void guardar(e)}>
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoUsd descripcion="Suma de corridas de hoy." etiqueta="Diario (USD)" onChange={(v) => setPresupuesto("diarioUsd", v)} value={form.presupuesto.diarioUsd} />
              <CampoUsd descripcion="Últimos 7 días." etiqueta="Semanal (USD)" onChange={(v) => setPresupuesto("semanalUsd", v)} value={form.presupuesto.semanalUsd} />
              <CampoUsd descripcion="Ciclo mensual de Apify." etiqueta="Mensual (USD)" onChange={(v) => setPresupuesto("mensualUsd", v)} value={form.presupuesto.mensualUsd} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <CampoEntero etiqueta="Umbral 1 (%)" max={100} min={0} onChange={(v) => setUmbral(0, v)} sufijo="Aviso informativo." value={umbrales[0]} />
              <CampoEntero etiqueta="Umbral 2 (%)" max={100} min={0} onChange={(v) => setUmbral(1, v)} sufijo="Aviso." value={umbrales[1]} />
              <CampoEntero etiqueta="Umbral 3 (%)" max={100} min={0} onChange={(v) => setUmbral(2, v)} sufijo="Crítico." value={umbrales[2]} />
            </div>

            <div className="flex flex-col gap-4 rounded-md border border-border p-4">
              <label className="flex items-center gap-3 text-sm" htmlFor={idPausar}>
                <Switch
                  checked={pausarAl100}
                  id={idPausar}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, saltarSiPctMensual: v ? 100 : 90 }))}
                />
                <span className="flex flex-col">
                  <span className="text-fg">Pausar Apify solo al llegar al 100 % del mes</span>
                  <span className="text-xs text-fg-muted">
                    Desactivado, Apify se omite de las corridas a partir del porcentaje mensual que fijes abajo.
                  </span>
                </span>
              </label>
              {!pausarAl100 && (
                <div className="max-w-xs">
                  <CampoEntero
                    etiqueta="Omitir Apify a partir de (%)"
                    max={99}
                    min={0}
                    onChange={(v) => setForm((f) => ({ ...f, saltarSiPctMensual: v }))}
                    sufijo="Del presupuesto mensual."
                    value={form.saltarSiPctMensual}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <CampoEntero
                descripcion="Posts por perfil de Instagram en cada corrida (≈ $0.0027 cada uno)."
                etiqueta="Resultados por perfil"
                max={200}
                min={1}
                onChange={(v) => setForm((f) => ({ ...f, resultsLimitPorPerfil: v }))}
                value={form.resultsLimitPorPerfil}
              />
              <label className="flex items-center gap-3 self-end pb-5 text-sm" htmlFor={idHabilitado}>
                <Switch checked={form.habilitado} id={idHabilitado} onCheckedChange={(v) => setForm((f) => ({ ...f, habilitado: v }))} />
                <span className="flex flex-col">
                  <span className="text-fg">Apify habilitado</span>
                  <span className="text-xs text-fg-muted">Desactivado, ninguna corrida lo usa aunque haya token.</span>
                </span>
              </label>
            </div>

            <div>
              <Button loading={guardando} type="submit">
                <Save aria-hidden="true" />
                Guardar presupuestos
              </Button>
            </div>
          </Form>
        </CardPanel>
      </Card>

      <Card className="h-fit rounded-lg">
        <CardHeader>
          <CardTitle className="t-label">Vista previa</CardTitle>
          <CardDescription className="text-fg-muted">Lo que verás en la barra lateral. Se recalcula al guardar.</CardDescription>
        </CardHeader>
        <CardPanel>
          <UsageMeter collapsible={false} key={version} />
        </CardPanel>
      </Card>
    </div>
  );
}
