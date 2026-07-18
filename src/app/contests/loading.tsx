import { Skeleton } from "@/components/ui/skeleton";

export default function ContestsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-7 flex items-center gap-3 rounded-lg border border-border/60 px-4 py-3">
        <Skeleton className="size-9 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-3 w-full max-w-72" />
        </div>
      </div>
      <div className="mt-8 rounded-lg border border-border/60 p-3">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-7 w-24" />
          ))}
        </div>
      </div>
      <div className="mt-7 space-y-3">
        <Skeleton className="h-4 w-28" />
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
