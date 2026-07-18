import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-6 h-44 w-full rounded-lg" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}
