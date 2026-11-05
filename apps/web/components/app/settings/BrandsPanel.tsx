"use client";

import { Archive, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtFecha } from "@/lib/format";
import { avisarError, avisarOk, llamarApi } from "@/lib/settings/cliente";
import type { MarcaAjustes } from "@/lib/settings/tipos";
import { CuerpoNuevaMarca, primerError } from "@/lib/settings/validacion";

function NuevaMarcaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }): React.ReactElement {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const id = useId();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = CuerpoNuevaMarca.safeParse({ nombre });
    if (!res.success) {
      setError(primerError(res.error));
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await llamarApi<{ marca: MarcaAjustes }>("/api/marcas", { method: "POST", body: res.data });
      avisarOk(`Marca «${r.marca.nombre}» creada`, `Carpeta marcas/${r.marca.slug}/ lista. Añade sus competidores.`);
      setNombre("");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup>
        <Form onSubmit={(e) => void enviar(e)}>
          <DialogHeader>
            <DialogTitle>Nueva marca</DialogTitle>
            <DialogDescription>Se crea <code>marcas/&lt;slug&gt;/</code> con su lista de vigilancia vacía y su log.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field invalid={error !== null} name="nombre">
              <FieldLabel htmlFor={id}>Nombre</FieldLabel>
              <Input
                autoFocus
                id={id}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setError(null);
                }}
                placeholder="Kola Real"
                value={nombre}
              />
              <FieldDescription>El slug se deriva del nombre (minúsculas, sin acentos).</FieldDescription>
              {error && <FieldError match>{error}</FieldError>}
            </Field>
          </DialogPanel>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancelar
            </Button>
            <Button loading={enviando} type="submit">
              Crear marca
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}

function ArchivarDialog({ marca, onOpenChange }: { marca: MarcaAjustes | null; onOpenChange: (o: boolean) => void }): React.ReactElement {
  const router = useRouter();
  const [escrito, setEscrito] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const id = useId();
  const coincide = marca !== null && escrito.trim().toLowerCase() === marca.nombre.trim().toLowerCase();

  const archivar = async () => {
    if (!marca || !coincide) return;
    setEnviando(true);
    setError(null);
    try {
      await llamarApi(`/api/marcas/${encodeURIComponent(marca.slug)}/archivar`, { method: "POST", body: { nombre: escrito } });
      avisarOk(`Marca «${marca.nombre}» archivada`, `Movida a marcas/_archivo/${marca.slug}. Nada se borró.`);
      setEscrito("");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AlertDialog
      onOpenChange={(o) => {
        if (!o) {
          setEscrito("");
          setError(null);
        }
        onOpenChange(o);
      }}
      open={marca !== null}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Archivar «{marca?.nombre}»</AlertDialogTitle>
          <AlertDialogDescription>
            La carpeta se mueve a <code>marcas/_archivo/</code> con su log y sus corridas intactos; nunca se borra. Para
            confirmar, escribe el nombre exacto de la marca.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="px-6 pb-4">
          <Field invalid={error !== null} name="confirmacion">
            <FieldLabel htmlFor={id}>Nombre de la marca</FieldLabel>
            <Input autoComplete="off" id={id} onChange={(e) => setEscrito(e.target.value)} placeholder={marca?.nombre} value={escrito} />
            {error && <FieldError match>{error}</FieldError>}
          </Field>
        </div>
        <AlertDialogFooter>
          <Button disabled={enviando} onClick={() => onOpenChange(false)} variant="outline">
            Cancelar
          </Button>
          <Button disabled={!coincide} loading={enviando} onClick={() => void archivar()} variant="destructive">
            <Archive aria-hidden="true" />
            Archivar
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}

/** Pestaña Marcas: tabla + alta (Dialog) + archivo (AlertDialog con nombre). */
export function BrandsPanel({ marcas, activa }: { marcas: MarcaAjustes[]; activa: string | null }): React.ReactElement {
  const [nueva, setNueva] = useState(false);
  const [aArchivar, setAArchivar] = useState<MarcaAjustes | null>(null);

  const abrirArchivar = (m: MarcaAjustes) => {
    if (marcas.length <= 1) {
      avisarError("No se puede archivar la única marca", "Crea otra marca antes de archivar esta.");
      return;
    }
    setAArchivar(m);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="t-label">Marcas</CardTitle>
          <CardDescription className="text-fg-muted">Cada marca vigila su propia lista de competidores y tiene su propio histórico.</CardDescription>
        </div>
        <Button onClick={() => setNueva(true)} size="sm">
          <Plus aria-hidden="true" />
          Nueva marca
        </Button>
      </CardHeader>
      <CardPanel className="p-0 sm:px-2 sm:pb-2">
        {marcas.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-fg-muted">Sin marcas. Crea la primera con «Nueva marca».</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Competidores</TableHead>
                <TableHead>Última corrida</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {marcas.map((m) => (
                <TableRow key={m.slug}>
                  <TableCell className="font-medium text-fg">
                    <span className="flex items-center gap-2">
                      {m.nombre}
                      {m.slug === activa && (
                        <Badge size="sm" variant="secondary">
                          activa
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="font-code text-xs text-fg-muted">{m.slug}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{m.competidores}</TableCell>
                  <TableCell className="text-fg-muted">{fmtFecha(m.ultimaCorrida)}</TableCell>
                  <TableCell>
                    <Button aria-label={`Archivar ${m.nombre}`} onClick={() => abrirArchivar(m)} size="xs" variant="ghost">
                      <Archive aria-hidden="true" />
                      Archivar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardPanel>
      <NuevaMarcaDialog onOpenChange={setNueva} open={nueva} />
      <ArchivarDialog marca={aArchivar} onOpenChange={(o) => !o && setAArchivar(null)} />
    </Card>
  );
}
