"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import CountUp from "@/components/bits/CountUp";
import { SpotlightCard } from "@/components/bits/SpotlightCard";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  /** Etiqueta superior (.t-label). */
  label: string;
  /** Valor numérico; se anima con CountUp. */
  value: number;
  /** Texto en vez de número (p. ej. una fecha). Si se da, no hay CountUp. */
  valueText?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Delta vs. corrida anterior. Positivo → verde (nuevo), negativo → rojo. */
  delta?: number | null;
  /** Texto del delta si no es numérico (p. ej. "sin anterior"). */
  deltaLabel?: string;
  /** ¿Un delta positivo es bueno? false invierte el color (p. ej. fallos). */
  positiveIsGood?: boolean;
  /** Subtexto bajo el valor. */
  hint?: string;
  className?: string;
}

function DeltaBadge({
  delta,
  deltaLabel,
  positiveIsGood,
}: Pick<KpiCardProps, "delta" | "deltaLabel" | "positiveIsGood">): React.ReactElement | null {
  if (delta === undefined || delta === null) {
    if (!deltaLabel) return null;
    return (
      <span className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-s-sin-datos-soft px-1.5 text-[11px] font-medium text-s-sin-datos">
        <Minus aria-hidden="true" className="size-3" />
        {deltaLabel}
      </span>
    );
  }
  const good = delta === 0 ? null : (delta > 0) === (positiveIsGood ?? true);
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const sign = delta > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "tnum inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11px] font-medium",
        good === null && "bg-s-sin-datos-soft text-s-sin-datos",
        good === true && "bg-s-nuevo-soft text-s-nuevo",
        good === false && "bg-s-no-funciona-soft text-s-no-funciona",
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {deltaLabel ?? `${sign}${delta}`}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  valueText,
  prefix,
  suffix,
  decimals,
  delta,
  deltaLabel,
  positiveIsGood,
  hint,
  className,
}: KpiCardProps): React.ReactElement {
  return (
    <SpotlightCard className={cn("flex min-h-[120px] flex-col gap-3 p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="t-label min-w-0">{label}</span>
        <DeltaBadge
          delta={delta}
          deltaLabel={deltaLabel}
          positiveIsGood={positiveIsGood}
        />
      </div>
      <div className="t-kpi">
        {valueText ?? (
          <CountUp
            decimals={decimals}
            duration={1.2}
            prefix={prefix}
            separator=","
            suffix={suffix}
            to={value}
            trigger="load"
          />
        )}
      </div>
      {hint && <p className="text-xs text-fg-dim">{hint}</p>}
    </SpotlightCard>
  );
}
