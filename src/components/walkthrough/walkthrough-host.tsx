"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dismissTourNudge,
  isNudgeDismissed,
  isTourMarkedDone,
} from "./storage";
import { tourIdForPathname } from "./tours";
import { runWalkthrough } from "./run-walkthrough";

const noopSubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function WalkthroughHost() {
  const pathname = usePathname();
  const isClient = useIsClient();
  const [storageEpoch, setStorageEpoch] = useState(0);

  const tourId = tourIdForPathname(pathname);
  const visible = useMemo(() => {
    if (!isClient || !tourId) return false;
    void storageEpoch;
    return !isTourMarkedDone(tourId) && !isNudgeDismissed(tourId);
  }, [isClient, tourId, storageEpoch]);

  const bumpStorage = () => setStorageEpoch((n) => n + 1);

  if (!tourId || !visible) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md sm:left-auto sm:right-6 sm:translate-x-0"
      role="region"
      aria-label="Page tour prompt"
    >
      <p className="flex-1 text-[13px] text-muted-foreground leading-snug">
        New here? Take a short tour of this page.
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          className="h-8 text-[12px]"
          onClick={() => {
            dismissTourNudge(tourId);
            bumpStorage();
            runWalkthrough(tourId);
          }}
        >
          Start tour
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground"
          aria-label="Dismiss"
          onClick={() => {
            dismissTourNudge(tourId);
            bumpStorage();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
