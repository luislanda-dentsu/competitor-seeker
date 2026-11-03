"use client";

import { AtSign, ClipboardPaste, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { parseCompetidoresTxt } from "@competitor-seeker/core/competidores";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { avisarError, avisarOk, llamarApi } from "@/lib/settings/cliente";
import type { CompetidorAjustes, MarcaAjustes } from "@/lib/settings/tipos";
import { CuerpoCompetidores, esUrlHttp, esUrlInstagram } from "@/lib/settings/validacion";
import { cn } from "@/lib/utils";

interface Fila {
  clave: number;
  nombre: string;
  url: string;
  activo: boolean;
}

type ErroresFila = Partial<Record<"nombre" | "url", string>>;

let contador = 0;
const nuevaClave = () => ++contador;

function aFilas(lista: readonly CompetidorAjustes[]): Fila[] {
  return lista.map((c) => ({ clave: nuevaClave(), nombre: c.nombre, url: c.url, activo: c.activo }));
}

function validarFilas(filas: readonly Fila[]): Map<number, ErroresFila> {
  const errores = new Map<number, ErroresFila>();
  const res = CuerpoCompetidores.safeParse({ competidores: filas.map(({ nombre, url, activo }) => ({ nombre, url, activo })) });
  if (res.success) return errores;
  for (const issue of res.error.issues) {
    const [idx, campo] = issue.path as [number, "nombre" | "url"];
    const fila = filas[idx];
    if (!fila || (campo !== "nombre" && campo !== "url")) continue;
    errores.set(fila.clave, { ...errores.get(fila.clave), [campo]: issue.message });
  }
  return errores;
}

/** Pestaña Competidores: tabla editable de la marca activa + pegado de lista `Nombre | URL`. */
export function CompetitorsPanel({ marca, competidores }: { marca: MarcaAjustes | null; competidores: CompetidorAjustes[] }): React.ReactElement {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>(() => aFilas(competidores));
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pegado, setPegado] = useState("");
  const [errores, setErrores] = useState<Map<number, ErroresFila>>(new Map());
  const idPegado = useId();

  const editar = (clave: number, cambio: Partial<Fila>) => {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));
    setSucio(true);
    setErrores((prev) => {
      if (!prev.has(clave)) return prev;
      const next = new Map(prev);
      next.delete(clave);
      return next;
    });
  };

  const agregar = () => {
    setFilas((prev) => [...prev, { clave: nuevaClave(), nombre: "", url: "", activo: true }]);
    setSucio(true);
  };

  const quitar = (clave: number) => {
    setFilas((prev) => prev.filter((f) => f.clave !== clave));
    setSucio(true);
  };

  const pegar = () => {
    const nuevos = parseCompetidoresTxt(pegado);
    if (nuevos.length === 0) {
      avisarError("Nada que importar", "Usa una línea por competidor con el formato «Nombre | URL».");
      return;
    }
    setFilas((prev) => {
      const existentes = new Set(prev.map((f) => f.nombre.trim().toLowerCase()));
      const añadidos = nuevos
        .filter((n) => !existentes.has(n.nombre.toLowerCase()))
        .map((n) => ({ clave: nuevaClave(), nombre: n.nombre, url: n.url ?? "", activo: true }));
      return [...prev, ...añadidos];
    });
    setPegado("");
    setSucio(true);
  };

  const guardar = async () => {
    if (!marca) return;
    const errs = validarFilas(filas);
    setErrores(errs);
    if (errs.size > 0) {
      avisarError("Revisa la lista", "Hay filas con nombre vacío, URL inválida o nombres repetidos.");
      return;
    }
    setGuardando(true);
    try {
      const r = await llamarApi<{ competidores: CompetidorAjustes[] }>(`/api/marcas/${encodeURIComponent(marca.slug)}/competidores`, {
        method: "PUT",
        body: { competidores: filas.map(({ nombre, url, activo }) => ({ nombre: nombre.trim(), url: url.trim(), activo })) },
      });
      setFilas(aFilas(r.competidores));
      setSucio(false);
      const activos = r.competidores.filter((c) => c.activo).length;
      avisarOk("Lista de vigilancia guardada", `${activos} ${activos === 1 ? "competidor activo" : "competidores activos"} en ${marca.nombre}.`);
      router.refresh();
    } catch (e) {
      avisarError("No se pudo guardar", (e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!marca) {
    return (
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="t-label">Competidores</CardTitle>
          <CardDescription className="text-fg-muted">No hay marca activa. Crea una en la pestaña Marcas.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-lg">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="t-label">Competidores de {marca.nombre}</CardTitle>
            <CardDescription className="text-fg-muted">
              Lista de vigilancia de <code>marca.json</code>. Quitar un competidor no borra su histórico: solo deja de rastrearse.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={agregar} size="sm" variant="outline">
              <Plus aria-hidden="true" />
              Añadir
            </Button>
            <Button disabled={!sucio} loading={guardando} onClick={() => void guardar()} size="sm">
              <Save aria-hidden="true" />
              Guardar
            </Button>
          </div>
        </CardHeader>
        <CardPanel className="p-0 sm:px-2 sm:pb-2">
          {filas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-muted">Sin competidores. Añade uno o pega una lista abajo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32%]">Nombre</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-px">Activo</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => {
                  const err = errores.get(f.clave);
                  const esIg = esUrlInstagram(f.url);
                  return (
                    <TableRow className="align-top" key={f.clave}>
                      <TableCell className="whitespace-normal">
                        <Input
                          aria-invalid={err?.nombre ? true : undefined}
                          aria-label="Nombre del competidor"
                          onChange={(e) => editar(f.clave, { nombre: e.target.value })}
                          placeholder="Nombre"
                          size="sm"
                          value={f.nombre}
                        />
                        {err?.nombre && <p className="mt-1 text-xs text-s-no-funciona">{err.nombre}</p>}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <span className="flex items-center gap-2">
                          <Input
                            aria-invalid={err?.url ? true : undefined}
                            aria-label="URL del competidor"
                            inputMode="url"
                            onChange={(e) => editar(f.clave, { url: e.target.value })}
                            placeholder="https://www.instagram.com/usuario/"
                            size="sm"
                            value={f.url}
                          />
                          {esIg ? (
                            <Tooltip>
                              <TooltipTrigger render={<span className="inline-flex shrink-0 text-fg-muted" />}>
                                <AtSign aria-label="Perfil de Instagram" className="size-4" />
                              </TooltipTrigger>
                              <TooltipPopup>Instagram: se rastrea con el navegador y, si está habilitado, con Apify.</TooltipPopup>
                            </Tooltip>
                          ) : (
                            <span aria-hidden="true" className={cn("inline-block size-4 shrink-0", f.url && !esUrlHttp(f.url) && "text-s-no-funciona")} />
                          )}
                        </span>
                        {err?.url && <p className="mt-1 text-xs text-s-no-funciona">{err.url}</p>}
                      </TableCell>
                      <TableCell>
                        <Switch aria-label={`${f.nombre || "competidor"} activo`} checked={f.activo} onCheckedChange={(v) => editar(f.clave, { activo: v })} />
                      </TableCell>
                      <TableCell>
                        <Button aria-label={`Quitar ${f.nombre || "fila"}`} onClick={() => quitar(f.clave)} size="icon-xs" variant="ghost">
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardPanel>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="t-label">Pegar lista</CardTitle>
          <CardDescription className="text-fg-muted">
            Una línea por competidor con el formato <code>Nombre | URL</code> (la URL es opcional; las líneas con <code>#</code> se ignoran).
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-3">
          <Field name="pegado">
            <FieldLabel className="sr-only" htmlFor={idPegado}>
              Lista de competidores
            </FieldLabel>
            <Textarea
              className="font-mono text-xs"
              id={idPegado}
              onChange={(e) => setPegado(e.target.value)}
              placeholder={"Coca-Cola RD | https://www.instagram.com/cocacolard/\nPepsi RD | https://www.pepsi.com.do/"}
              rows={4}
              value={pegado}
            />
            <FieldDescription>Los nombres que ya estén en la tabla se omiten. Después pulsa «Guardar».</FieldDescription>
          </Field>
          <div>
            <Button disabled={pegado.trim() === ""} onClick={pegar} size="sm" variant="outline">
              <ClipboardPaste aria-hidden="true" />
              Añadir a la tabla
            </Button>
          </div>
        </CardPanel>
      </Card>
    </div>
  );
}
