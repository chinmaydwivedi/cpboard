import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-40 max-w-full" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
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
        <Skeleton className="h-36 w-full" />
      </div>
      <div className="mb-6 rounded-lg border border-border/60 p-4">
        <Skeleton className="h-4 w-52 max-w-full" />
        <Skeleton className="mt-4 h-80 w-full" />
      </div>
      <div className="mb-6 rounded-lg border border-border/60 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border/60 p-4">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-8 h-64 w-full rounded-lg" />
      <Skeleton className="h-36 w-full rounded-lg" />
    </div>
  );
}
