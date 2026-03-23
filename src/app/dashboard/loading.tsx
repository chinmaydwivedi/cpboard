import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border/60 p-4">
            <Skeleton className="h-3 w-28 mb-3" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border/60 p-4 mb-6">
        <Skeleton className="h-3 w-20 mb-4" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border/60 p-4">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
