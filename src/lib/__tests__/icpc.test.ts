import { describe, expect, it } from "vitest";
import {
  ICPC_REGIONALS,
  ICPC_TIMELINE,
  getTimelineStatuses,
  type IcpcTimelineItem,
} from "@/lib/icpc";

const items: IcpcTimelineItem[] = [
  { id: "undated", title: "", when: "", start: null, description: "" },
  { id: "past", title: "", when: "", start: "2026-09-25", description: "" },
  { id: "soon", title: "", when: "", start: "2026-10-03", description: "" },
  { id: "range", title: "", when: "", start: "2026-12-10", end: "2027-01-02", description: "" },
  { id: "later", title: "", when: "", start: "2027-03-20", description: "" },
];

describe("getTimelineStatuses", () => {
  it("marks past stages done and only the first future stage as next", () => {
    expect(getTimelineStatuses(items, "2026-09-29")).toEqual({
      undated: "undated",
      past: "done",
      soon: "next",
      range: "upcoming",
      later: "upcoming",
    });
  });

  it("treats a stage as live through its last day, with no separate next", () => {
    const statuses = getTimelineStatuses(items, "2027-01-02");
    expect(statuses.range).toBe("live");
    expect(statuses.later).toBe("upcoming");
    expect(statuses.soon).toBe("done");
  });

  it("marks every dated stage done once the season is over", () => {
    const statuses = getTimelineStatuses(items, "2027-12-31");
    expect(Object.values(statuses).filter((s) => s !== "undated")).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
  });
});

describe("ICPC season data", () => {
  it("lists timeline stages in date order", () => {
    const starts = ICPC_TIMELINE.flatMap((item) => (item.start ? [item.start] : []));
    expect(starts).toEqual([...starts].sort());
  });

  it("lists regionals in date order with unique ids", () => {
    const starts = ICPC_REGIONALS.map((regional) => regional.start);
    expect(starts).toEqual([...starts].sort());
    expect(new Set(ICPC_REGIONALS.map((r) => r.id)).size).toBe(ICPC_REGIONALS.length);
  });
});
