"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl items-center px-5 py-12 text-center">
      <div className="w-full rounded-xl border border-border/60 bg-card/50 px-6 py-10">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Page unavailable
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          We couldn&apos;t load this page
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          We couldn&apos;t retrieve a complete response. Retry the request now, or
          return in a moment if the service is still recovering.
        </p>
        <Button type="button" className="mt-6" onClick={unstable_retry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      </div>
    </div>
  );
}
