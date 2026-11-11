import { Skeleton, KpiSkeletonRow } from "@/components/ui/skeleton";

/** Esqueleto mostrado na hora do clique enquanto a próxima página chega. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <KpiSkeletonRow />
      <Skeleton className="h-72" />
    </div>
  );
}
