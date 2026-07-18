"use client";

import type { DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { markTourComplete } from "./storage";
import { TOUR_STEPS, type TourId } from "./tours";

function existingSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    if (step.element == null) return true;
    if (typeof step.element !== "string") return true;
    try {
      return document.querySelector(step.element) != null;
    } catch {
      return false;
    }
  });
}

export async function runWalkthrough(tourId: TourId): Promise<boolean> {
  const raw = TOUR_STEPS[tourId];
  const steps = existingSteps(raw);
  if (steps.length === 0) return false;

  try {
    const { driver } = await import("driver.js");
    let lastHighlighted = 0;

    const driverObj = driver({
      showProgress: true,
      smoothScroll: true,
      stageRadius: 8,
      stagePadding: 6,
      popoverClass: "driver-popover-cpboard",
      overlayColor: "#07070c",
      overlayOpacity: 0.78,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      progressText: "{{current}} of {{total}}",
      steps,
      onHighlighted: (_e, _s, { driver: d }) => {
        lastHighlighted = d.getActiveIndex() ?? 0;
      },
      onDestroyed: () => {
        if (lastHighlighted >= steps.length - 1) {
          markTourComplete(tourId);
        }
      },
    });

    driverObj.drive();
    return true;
  } catch {
    return false;
  }
}
