/** Bump when tour copy or steps change so users can see updates. */
export const WALKTHROUGH_VERSION = "v1";

export function tourDoneKey(tourId: string) {
  return `cpboard_tour_done_${WALKTHROUGH_VERSION}_${tourId}`;
}

export function tourNudgeDismissedKey(tourId: string) {
  return `cpboard_tour_nudge_${WALKTHROUGH_VERSION}_${tourId}`;
}

export function isTourMarkedDone(tourId: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(tourDoneKey(tourId)) === "1";
}

export function isNudgeDismissed(tourId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(tourNudgeDismissedKey(tourId)) === "1";
}

export function markTourComplete(tourId: string) {
  localStorage.setItem(tourDoneKey(tourId), "1");
}

export function dismissTourNudge(tourId: string) {
  localStorage.setItem(tourNudgeDismissedKey(tourId), "1");
}
