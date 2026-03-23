import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-60" />
      </div>
      <div className="flex gap-3 mb-6">
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-9 w-44" />
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
