import { cn } from "@/lib/utils";
import { normSenal, SIGNAL_META } from "@/components/app/signals/signal-meta";

export interface SignalBadgeProps extends React.ComponentProps<"span"> {
  /** Cualquier string: fuera del enum se pinta como "Señal inválida". */
  senal: unknown;
  size?: "sm" | "default";
  /** Muestra el punto de color delante de la etiqueta. */
  dot?: boolean;
}

/** Píldora de señal: nunca solo color (siempre lleva el texto). */
export function SignalBadge({
  senal,
  size = "default",
  dot = true,
  className,
  ...props
}: SignalBadgeProps): React.ReactElement {
  const key = normSenal(senal);
  const meta = SIGNAL_META[key];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill font-medium",
        size === "default" ? "h-6 px-2.5 text-xs" : "h-5 px-2 text-[11px]",
        meta.bg,
        meta.text,
        className,
      )}
      data-senal={key}
      data-slot="signal-badge"
      title={meta.descripcion}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", meta.dot)}
        />
      )}
      {meta.label}
    </span>
  );
}
