"use client";

import { Suspense, useTransition } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setMarcaActiva } from "@/lib/brand-actions";
import { useContextoMarca } from "@/lib/brand-context";
import { cn } from "@/lib/utils";

export interface BrandOption {
  slug: string;
  nombre: string;
}

const TRIGGER_CLASS =
  "h-8 min-h-8 min-w-0 rounded-pill bg-card-2 text-fg sm:h-8 border-transparent shadow-none";

function BrandSwitcherLive(): React.ReactElement {
  const { marcas, activa } = useContextoMarca();
  const [pending, startTransition] = useTransition();

  if (marcas.length === 0) {
    return (
      <span
        className={cn(
          TRIGGER_CLASS,
          "inline-flex items-center gap-2 px-3 text-sm text-fg-muted",
        )}
      >
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-s-sin-datos" />
        Sin marcas
      </span>
    );
  }

  const items = marcas.map((m) => ({ label: m.nombre, value: m.slug }));
  return (
    <Select
      items={items}
      onValueChange={(v) => {
        if (typeof v === "string" && v !== activa) {
          startTransition(async () => {
            await setMarcaActiva(v);
          });
        }
      }}
      value={activa ?? items[0]?.value ?? ""}
    >
      <SelectTrigger
        aria-busy={pending || undefined}
        aria-label="Marca activa"
        className={cn(TRIGGER_CLASS, pending && "opacity-70")}
        size="sm"
      >
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
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
  );
}

/**
 * Selector de marca activa (global). La lista y la marca activa llegan del
 * AppShell vía BrandProvider (cookie `cs-marca`); al cambiar llama a la
 * server action `setMarcaActiva`, que fija la cookie y revalida el layout.
 */
export function BrandSwitcher(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <Skeleton aria-label="Cargando marcas" className="h-8 w-28 rounded-pill" />
      }
    >
      <BrandSwitcherLive />
    </Suspense>
  );
}
