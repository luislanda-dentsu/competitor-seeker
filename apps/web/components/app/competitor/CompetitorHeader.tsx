import { AtSign, ExternalLink } from "lucide-react";
import { SignalBadge } from "@/components/app/signals/SignalBadge";
import { SIGNAL_META } from "@/components/app/signals/signal-meta";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SENALES_ORDEN } from "@/lib/data/agrupar";
import type { DatosCompetidor } from "@/lib/data/competidor";
import { fmtFecha, fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

function Dato({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="t-label">{label}</span>
      <span className="font-mono text-sm tabular-nums text-fg">{children}</span>
    </div>
  );
}

/** Cabecera de la ficha: avatar, nombre, señal, enlace, contadores y chips. */
export function CompetitorHeader({ datos }: { datos: DatosCompetidor }): React.ReactElement {
  const { competidor: c, conteo, nCorridas, entradas } = datos;
  const ultimo = c.semaforo;
  const esIg = Boolean(c.instagram);
  const inicial = c.nombre.trim().charAt(0).toUpperCase() || "?";
  return (
    <Card className="gap-5 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className="[--avatar-size:--spacing(12)] bg-card-2 text-fg">
          <AvatarFallback aria-hidden="true" className="bg-card-2 text-lg font-medium">
            {inicial}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-xl font-medium text-fg">{c.nombre}</h2>
            {c.senal ? (
              <SignalBadge senal={c.senal} />
            ) : (
              <span className="text-xs text-fg-dim">sin registros</span>
            )}
            {!c.activo && (
              <span className="rounded-pill bg-card-2 px-2 py-0.5 text-xs text-fg-muted">
                inactivo
              </span>
            )}
          </div>
          {c.url && (
            <a
              className="inline-flex w-fit items-center gap-1.5 text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
              href={c.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              {esIg ? (
                <AtSign aria-hidden="true" className="size-4" />
              ) : (
                <ExternalLink aria-hidden="true" className="size-4" />
              )}
              <span className="truncate">{esIg ? `@${c.instagram}` : c.url}</span>
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          )}
        </div>
        <div className="grid grid-cols-3 gap-5">
          <Dato label="Registros">{fmtInt(entradas.length)}</Dato>
          <Dato label="Corridas">{fmtInt(nCorridas)}</Dato>
          <Dato label="Último">{fmtFecha(ultimo?.fecha)}</Dato>
        </div>
      </div>

      {ultimo && (
        <p className="line-clamp-2 text-sm text-fg" title={ultimo.movimiento}>
          <span className="t-label me-2">Último movimiento</span>
          {ultimo.movimiento}
        </p>
      )}

      <ul aria-label="Entradas por señal" className="flex flex-wrap gap-2">
        {SENALES_ORDEN.map((s) => (
          <li
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-xs font-medium",
              SIGNAL_META[s].bg,
              SIGNAL_META[s].text,
              conteo[s] === 0 && "opacity-50",
            )}
            key={s}
          >
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", SIGNAL_META[s].dot)} />
            {SIGNAL_META[s].label}
            <span className="font-mono tabular-nums">{conteo[s]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
