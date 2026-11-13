import type { ReactNode } from "react";

/** Tarjeta centrada de las pantallas de entrada (sin shell). */
export function PantallaAcceso({ titulo, children }: { titulo: string; children: ReactNode }): React.ReactElement {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-[var(--radius-card)] bg-card p-7">
        <div className="flex flex-col gap-1">
          <span className="t-label">Competitor-Seeker</span>
          <h1 className="text-xl font-semibold text-fg">{titulo}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
