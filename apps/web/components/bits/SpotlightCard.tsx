"use client";

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta con luz que sigue al cursor (patrón SpotlightCard de React Bits, como en Orbit):
 * un radial del acento de la vista (--spot) al `intensity` y un brillo de borde al `borderGlow`.
 * Sin JS de animación: el puntero solo fija --mx/--my; con puntero táctil no se pinta.
 */
export function SpotlightCard({
  children,
  className,
  intensity = 0.07,
  borderGlow = 0.35,
  size = 220,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  borderGlow?: number;
  size?: number;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    el.style.setProperty("--spot-on", "1");
  };
  const salir = () => ref.current?.style.setProperty("--spot-on", "0");
  const vars = {
    "--spot-i": `${Math.round(intensity * 100)}%`,
    "--spot-b": `${Math.round(borderGlow * 100)}%`,
    "--spot-size": `${size}px`,
  } as CSSProperties;
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[var(--radius-card)] bg-card text-card-foreground",
        // luz interior
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-[var(--spot-on,0)] before:transition-opacity before:duration-300",
        "before:bg-[radial-gradient(var(--spot-size)_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_oklab,var(--spot)_var(--spot-i),transparent),transparent_70%)]",
        // brillo de borde (máscara de 1px)
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:p-px after:opacity-[var(--spot-on,0)] after:transition-opacity after:duration-300",
        "after:bg-[radial-gradient(var(--spot-size)_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_oklab,var(--spot)_var(--spot-b),transparent),transparent_70%)]",
        "after:[mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)]",
        className,
      )}
      data-slot="card"
      onPointerLeave={salir}
      onPointerMove={mover}
      ref={ref}
      style={vars}
    >
      {children}
    </div>
  );
}
