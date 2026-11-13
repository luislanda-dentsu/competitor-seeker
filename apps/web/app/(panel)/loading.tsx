import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton({
  className,
  alto = "h-56",
}: {
  className?: string;
  alto?: string;
}): React.ReactElement {
  return (
    <div className={`flex flex-col gap-4 rounded-[var(--radius-card)] bg-card p-5 ${className ?? ""}`}>
      <Skeleton className="h-3 w-32" />
      <Skeleton className={`${alto} w-full`} />
    </div>
  );
}

/** Skeleton del Resumen: 4 KPI + tendencia/distribución + embudo/lista + corridas. */
export default function Loading(): React.ReactElement {
  return (
    <div aria-busy="true" aria-label="Cargando resumen" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-card p-5"
            key={i}
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-12 rounded-pill" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <CardSkeleton className="lg:col-span-8" />
        <CardSkeleton className="lg:col-span-4" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <CardSkeleton alto="h-40" className="lg:col-span-4" />
        <CardSkeleton alto="h-40" className="lg:col-span-8" />
      </div>
      <CardSkeleton alto="h-16" />
    </div>
  );
}
