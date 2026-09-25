import { describe, expect, it } from "vitest";
import {
  compareLeaderboardScores,
  computeBestRating,
  computeTotalSolved,
  getCodeforcesRankTitle,
} from "@/lib/scoring";

type Profile = Parameters<typeof computeTotalSolved>[0][number];

const profile = (overrides: Partial<Profile>): Profile => ({
  platform: "CODEFORCES",
  rating: 0,
  maxRating: 0,
  problemsSolved: 0,
  ...overrides,
});

describe("computeTotalSolved", () => {
  it("sums solved counts across platforms", () => {
    expect(
      computeTotalSolved([
        profile({ platform: "CODEFORCES", problemsSolved: 120 }),
        profile({ platform: "LEETCODE", problemsSolved: 300 }),
      ]),
    ).toBe(420);
  });

  it("returns 0 with no profiles", () => {
    expect(computeTotalSolved([])).toBe(0);
  });
});

describe("computeBestRating", () => {
  it("uses only the LeetCode rating", () => {
    expect(
      computeBestRating([
        profile({ platform: "CODEFORCES", rating: 2400, maxRating: 2500 }),
        profile({ platform: "LEETCODE", rating: 1850, maxRating: 1900 }),
      ]),
    ).toBe(1850);
  });

  it("falls back to max rating when current rating is 0", () => {
    expect(
      computeBestRating([profile({ platform: "LEETCODE", maxRating: 1700 })]),
    ).toBe(1700);
  });

  it("returns 0 without a LeetCode profile", () => {
    expect(
      computeBestRating([profile({ platform: "CODEFORCES", rating: 2000 })]),
    ).toBe(0);
  });
});

describe("compareLeaderboardScores", () => {
  const entry = (username: string, totalSolved: number, bestRating = 0) => ({
    username,
    totalSolved,
    bestRating,
  });

  it("orders by solved, then rating, then username byte order", () => {
    const sorted = [
      entry("bob", 10, 1500),
      entry("alice", 10, 1500),
      entry("Zed", 10, 1500),
      entry("carol", 10, 1800),
      entry("dave", 20),
    ].sort(compareLeaderboardScores);

    // Byte order puts uppercase before lowercase, matching COLLATE "C" in
    // the leader-alert SQL query.
    expect(sorted.map((e) => e.username)).toEqual([
      "dave",
      "carol",
      "Zed",
      "alice",
      "bob",
    ]);
  });
});

describe("getCodeforcesRankTitle", () => {
  it.each([
    [0, "Newbie"],
    [1199, "Newbie"],
    [1200, "Pupil"],
    [1600, "Expert"],
    [2300, "International Master"],
    [3000, "Legendary Grandmaster"],
  ])("rating %i is %s", (rating, title) => {
    expect(getCodeforcesRankTitle(rating)).toBe(title);
  });
});
