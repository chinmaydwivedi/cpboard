import { Skeleton } from "@/components/ui/skeleton";

export default function CPRankingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg border border-border/60 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-border/60 p-6">
        <Skeleton className="mx-auto h-5 w-28" />
        <div className="mt-8 grid items-end gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
        </div>
      </div>
      <Skeleton className="mt-6 h-72 w-full rounded-lg" />
      <Skeleton className="mt-6 h-96 w-full rounded-lg" />
    </div>
  );
}
