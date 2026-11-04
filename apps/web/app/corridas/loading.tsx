import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton de Corridas: lanzador + historial. */
export default function Loading(): React.ReactElement {
  return (
    <div aria-busy="true" aria-label="Cargando corridas" className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 lg:flex-row lg:items-end lg:gap-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36 lg:ms-auto" />
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
