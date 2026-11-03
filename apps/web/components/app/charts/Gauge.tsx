import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/format";

/**
 * Gauge semicircular SVG (sin librerías). `valor` en 0–100.
 * El número va en mono tabular dentro del arco; el color del arco es el
 * acento de marca, el carril el borde.
 */
export function Gauge({
  valor,
  label,
  className,
}: {
  valor: number;
  label: string;
  className?: string;
}): React.ReactElement {
  const v = Math.max(0, Math.min(100, Number.isFinite(valor) ? valor : 0));
  const r = 44;
  const cx = 50;
  const cy = 50;
  const largo = Math.PI * r; // semicircunferencia
  const trazo = (v / 100) * largo;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <figure className={cn("flex flex-col items-center gap-1", className)}>
      <svg
        aria-label={`${label}: ${fmtPct(v, { scaled: true })}`}
        className="w-full max-w-[180px]"
        role="img"
        viewBox="0 0 100 56"
      >
        <path
          d={d}
          fill="none"
          stroke="var(--border)"
          strokeLinecap="round"
          strokeWidth={8}
        />
        <path
          d={d}
          fill="none"
          stroke="var(--brand)"
          strokeDasharray={`${trazo} ${largo}`}
          strokeLinecap="round"
          strokeWidth={8}
        />
        <text
          fill="var(--fg)"
          fontFamily="var(--font-mono)"
          fontSize={16}
          fontWeight={500}
          textAnchor="middle"
          x={cx}
          y={cy - 2}
        >
          {fmtPct(v, { scaled: true })}
        </text>
      </svg>
      <figcaption className="t-label">{label}</figcaption>
    </figure>
  );
}
