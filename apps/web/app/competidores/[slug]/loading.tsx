import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton de la ficha: breadcrumb + cabecera + tabs con 3 filas. */
export default function Loading(): React.ReactElement {
  return (
    <div aria-busy="true" aria-label="Cargando competidor" className="flex flex-col gap-4">
      <Skeleton className="h-4 w-64" />
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton className="h-6 w-24 rounded-pill" key={i} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <Skeleton className="h-8 w-72 rounded-lg" />
        {Array.from({ length: 3 }, (_, i) => (
          <div className="flex gap-3" key={i}>
            <Skeleton className="size-3 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
