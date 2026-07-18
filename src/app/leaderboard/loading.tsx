import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-60" />
      </div>
      <div className="mb-6 flex min-h-28 items-center rounded-lg border border-border/60 p-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="ml-3 min-w-0 flex-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-4 w-full max-w-80" />
          <Skeleton className="mt-2 h-3 w-48 max-w-full" />
        </div>
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-9 w-full sm:w-60" />
        <Skeleton className="h-9 w-full sm:w-44" />
      </div>
      <div className="rounded-lg border border-border/60 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/40">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 flex-1 max-w-[180px]" />
            <Skeleton className="h-4 w-10 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
