"use client";

import { CalendarRange } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLAVES_PERIODO, ETIQUETA_PERIODO, PERIODO_COOKIE, type ClavePeriodo, type PeriodoUi } from "@/lib/periodo";

const UN_ANO = 60 * 60 * 24 * 365;

/**
 * Selector del periodo de análisis. Escribe ?p=… (y desde/hasta) en la URL,
 * conservando el resto de parámetros, y recuerda la elección en cs-periodo.
 */
export function PeriodoSelector({ periodo }: { periodo: PeriodoUi }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const actuales = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(periodo.desde ?? "");
  const [hasta, setHasta] = useState(periodo.hasta ?? "");

  const aplicar = (nuevos: Record<string, string>) => {
    const qs = new URLSearchParams(actuales?.toString());
    for (const k of ["p", "desde", "hasta"]) qs.delete(k);
    for (const [k, v] of Object.entries(nuevos)) qs.set(k, v);
    const soloPeriodo = new URLSearchParams(nuevos).toString();
    document.cookie = `${PERIODO_COOKIE}=${encodeURIComponent(soloPeriodo)}; path=/; max-age=${UN_ANO}; samesite=lax`;
    startTransition(() => router.replace(`${pathname}?${qs.toString()}`, { scroll: false }));
  };

  const items = CLAVES_PERIODO.map((c) => ({ value: c, label: ETIQUETA_PERIODO[c] }));
  const customValido = /^\d{4}-\d{2}-\d{2}$/.test(desde) && /^\d{4}-\d{2}-\d{2}$/.test(hasta) && desde <= hasta;

  return (
    <div aria-busy={pendiente} className="flex flex-wrap items-center gap-2">
      <Select
        items={items}
        onValueChange={(v) => {
          if (typeof v !== "string") return;
          if (v === "custom") {
            setDesde(periodo.desde ?? "");
            setHasta(periodo.hasta ?? "");
            setAbierto(true);
          }
          else aplicar({ p: v as ClavePeriodo });
        }}
        value={periodo.clave}
      >
        <SelectTrigger aria-label="Periodo de análisis" className="w-48" size="sm">
          <CalendarRange aria-hidden="true" className="size-4 opacity-70" />
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
      <Popover
        onOpenChange={(open) => {
          // Al abrir, el rango refleja el periodo vigente (pudo cambiar con un preset).
          if (open) {
            setDesde(periodo.desde ?? "");
            setHasta(periodo.hasta ?? "");
          }
          setAbierto(open);
        }}
        open={abierto}
      >
        <PopoverTrigger render={<Button size="sm" variant="ghost" />}>
          <span className="font-mono text-xs tabular-nums text-fg-muted">
            {periodo.desde && periodo.hasta ? `${periodo.desde} → ${periodo.hasta}` : "sin límite"}
          </span>
        </PopoverTrigger>
        <PopoverPopup align="end" className="w-[min(18rem,calc(100vw-2rem))]" side="bottom">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!customValido) return;
              aplicar({ p: "custom", desde, hasta });
              setAbierto(false);
            }}
          >
            <h2 className="text-sm font-medium text-fg">Rango personalizado</h2>
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              Desde
              <Input onChange={(e) => setDesde(e.target.value)} size="sm" type="date" value={desde} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              Hasta
              <Input onChange={(e) => setHasta(e.target.value)} size="sm" type="date" value={hasta} />
            </label>
            <Button disabled={!customValido} size="sm" type="submit">
              Aplicar
            </Button>
          </form>
        </PopoverPopup>
      </Popover>
    </div>
  );
}
