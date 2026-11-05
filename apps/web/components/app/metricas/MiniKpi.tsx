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
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-[10px] bg-card-2 px-3 py-2.5", className)} title={title}>
      <span className="truncate text-xs text-fg-muted">{label}</span>
      <span className="tnum truncate text-lg font-medium tracking-[-0.03em] text-fg">{valor}</span>
      {sub && <span className="truncate text-xs text-fg-muted">{sub}</span>}
    </div>
  );
}
