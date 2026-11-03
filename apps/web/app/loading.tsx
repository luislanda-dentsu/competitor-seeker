import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton del Resumen: 4 KPI + 2 cards. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
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
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 lg:col-span-8">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 lg:col-span-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    </div>
  );
}
