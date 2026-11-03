import { cn } from "@/lib/utils";
import { normSenal, SIGNAL_META } from "@/components/app/signals/signal-meta";

export interface SignalDotProps extends Omit<React.ComponentProps<"span">, "children"> {
  senal: unknown;
  size?: "sm" | "default" | "lg";
}

/** Punto de color con aria-label: para tablas, leyendas y semáforos. */
export function SignalDot({
  senal,
  size = "default",
  className,
  ...props
}: SignalDotProps): React.ReactElement {
  const key = normSenal(senal);
  const meta = SIGNAL_META[key];
  return (
    <span
      aria-label={meta.label}
      className={cn(
        "inline-block shrink-0 rounded-full",
        size === "sm" && "size-1.5",
        size === "default" && "size-2",
        size === "lg" && "size-2.5",
        meta.dot,
        className,
      )}
      data-senal={key}
      data-slot="signal-dot"
      role="img"
      title={meta.label}
      {...props}
    />
  );
}
