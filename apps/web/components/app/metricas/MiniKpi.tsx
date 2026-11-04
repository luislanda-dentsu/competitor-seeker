import { cn } from "@/lib/utils";

/** Cifra compacta con etiqueta: bloque de las tarjetas de actividad y del grid de rendimiento. */
export function MiniKpi({
  label,
  valor,
  sub,
  title,
  className,
}: {
  label: string;
  valor: string;
  sub?: string;
  title?: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-md bg-card-2/60 px-3 py-2", className)} title={title}>
      <span className="truncate text-[11px] font-medium uppercase tracking-wide text-fg-dim">{label}</span>
      <span className="truncate font-mono text-lg font-medium tabular-nums text-fg">{valor}</span>
      {sub && <span className="truncate text-xs text-fg-muted">{sub}</span>}
    </div>
  );
}
