import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton del índice de competidores: cabecera + 4 tarjetas. */
export default function Loading(): React.ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando competidores"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-7 w-36 rounded-lg" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4" key={i}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
