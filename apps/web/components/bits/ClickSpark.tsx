"use client";

const COLORES = ["#f8620f", "#efd554", "#b1ffa3", "#6affe1"] as const;

/**
 * Chispas al hacer clic (patrón ClickSpark de React Bits, como el botón primario de Orbit):
 * 8 trazos de 9 px que salen 20 px en 420 ms con los cuatro vivos AMGC. Se pintan en
 * `position: fixed` sobre <body>, así no hace falta envolver el botón ni cambiar su layout.
 * Respeta prefers-reduced-motion (no pinta).
 */
export function lanzarChispas(
  x: number,
  y: number,
  { count = 8, radius = 20, size = 9, duration = 420 }: { count?: number; radius?: number; size?: number; duration?: number } = {},
): void {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < count; i++) {
    const deg = (360 * i) / count;
    const s = document.createElement("span");
    s.setAttribute("aria-hidden", "true");
    Object.assign(s.style, {
      position: "fixed",
      left: `${x - 1}px`,
      top: `${y}px`,
      width: "2px",
      height: `${size}px`,
      borderRadius: "1px",
      background: COLORES[i % COLORES.length],
      pointerEvents: "none",
      transformOrigin: "50% 0",
      zIndex: "100",
    });
    document.body.appendChild(s);
    s.animate(
      [
        { transform: `rotate(${deg}deg) translateY(4px) scaleY(1)`, opacity: 1 },
        { transform: `rotate(${deg}deg) translateY(${radius}px) scaleY(0)`, opacity: 0 },
      ],
      { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    ).onfinish = () => s.remove();
  }
}
