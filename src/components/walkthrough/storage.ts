import { safeLocalStorage } from "@/lib/browser-storage";

/** Bump when tour copy or steps change so users can see updates. */
export const WALKTHROUGH_VERSION = "v3";

export function tourDoneKey(tourId: string) {
  return `cpboard_tour_done_${WALKTHROUGH_VERSION}_${tourId}`;
}

export function tourNudgeDismissedKey(tourId: string) {
  return `cpboard_tour_nudge_${WALKTHROUGH_VERSION}_${tourId}`;
}

export function isTourMarkedDone(tourId: string): boolean {
  if (typeof window === "undefined") return true;
  return safeLocalStorage.getItem(tourDoneKey(tourId)) === "1";
}

export function isNudgeDismissed(tourId: string): boolean {
  if (typeof window === "undefined") return false;
  return safeLocalStorage.getItem(tourNudgeDismissedKey(tourId)) === "1";
}

export function markTourComplete(tourId: string) {
  safeLocalStorage.setItem(tourDoneKey(tourId), "1");
}

export function dismissTourNudge(tourId: string) {
  safeLocalStorage.setItem(tourNudgeDismissedKey(tourId), "1");
}
