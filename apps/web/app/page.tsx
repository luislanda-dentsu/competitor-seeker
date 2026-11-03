import { KpiCard } from "@/components/app/kpi/KpiCard";
import { SignalBadge } from "@/components/app/signals/SignalBadge";
import { SignalDot } from "@/components/app/signals/SignalDot";
import { SENALES_UI, SIGNAL_META } from "@/components/app/signals/signal-meta";
import { UnderConstruction } from "@/components/app/states/UnderConstruction";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { fmtFecha } from "@/lib/format";

export const metadata = { title: "Resumen" };

/**
 * Home (Fase 3 trae los datos reales). Mientras tanto, los KPI y las señales
 * de muestra validan tokens claro/oscuro, fuentes y CountUp.
 */
export default function ResumenPage() {
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Indicadores"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          delta={1}
          hint="En la lista de vigilancia de la marca"
          label="Competidores vigilados"
          value={6}
        />
        <KpiCard
          delta={3}
          hint="Nuevos vs. corrida anterior"
          label="Movimientos nuevos"
          value={8}
        />
        <KpiCard
          delta={-12}
          deltaLabel="-12 pts"
          hint="Entradas con URL verificable"
          label="% con evidencia"
          suffix=" %"
          value={83}
        />
        <KpiCard
          deltaLabel="verificada"
          hint="Corrida de muestra, sin datos reales"
          label="Última corrida"
          value={0}
          valueText={fmtFecha("2026-08-12")}
        />
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="t-label">Señales</CardTitle>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {SENALES_UI.map((s) => (
              <SignalBadge key={s} senal={s} />
            ))}
            <SignalBadge senal="PENDIENTE" />
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-muted">
            {SENALES_UI.map((s) => (
              <li className="flex items-center gap-2" key={s}>
                <SignalDot senal={s} />
                <span className="text-fg">{SIGNAL_META[s].label}</span>
                <span className="hidden sm:inline">· {SIGNAL_META[s].descripcion}</span>
              </li>
            ))}
          </ul>
        </CardPanel>
      </Card>

      <UnderConstruction
        detalle="Tendencia de señales, distribución, cadena de evidencia, lista de competidores y línea de tiempo de corridas."
        fase={3}
        titulo="Resumen"
      />
    </div>
  );
}
