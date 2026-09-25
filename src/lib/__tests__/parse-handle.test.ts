import { describe, expect, it } from "vitest";
import { extractHandle, getProfileUrl } from "@/lib/parse-handle";

describe("extractHandle", () => {
  it("returns a bare handle unchanged, trimmed", () => {
    expect(extractHandle("CODEFORCES", "  tourist ")).toBe("tourist");
  });

  it.each([
    ["CODEFORCES", "https://codeforces.com/profile/tourist", "tourist"],
    ["CODEFORCES", "codeforces.com/profile/tourist?locale=en", "tourist"],
    ["CODEFORCES", "https://codeforces.com/contests/with/Petr", "Petr"],
    ["LEETCODE", "https://leetcode.com/u/neal_wu/", "neal_wu"],
    ["LEETCODE", "https://leetcode.com/neal_wu", "neal_wu"],
    ["ATCODER", "https://atcoder.jp/users/tourist/history", "tourist"],
    ["CODECHEF", "https://www.codechef.com/users/gennady#top", "gennady"],
  ] as const)("%s: %s -> %s", (platform, input, handle) => {
    expect(extractHandle(platform, input)).toBe(handle);
  });

  it("falls back to the last path segment for unknown URLs", () => {
    expect(extractHandle("ATCODER", "https://example.com/someone/")).toBe(
      "someone",
    );
  });
});

describe("getProfileUrl", () => {
  it.each([
    ["CODEFORCES", "https://codeforces.com/profile/tourist"],
    ["LEETCODE", "https://leetcode.com/u/tourist"],
    ["ATCODER", "https://atcoder.jp/users/tourist"],
    ["CODECHEF", "https://www.codechef.com/users/tourist"],
  ] as const)("%s", (platform, url) => {
    expect(getProfileUrl(platform, "tourist")).toBe(url);
  });

  it("round-trips through extractHandle", () => {
    for (const platform of [
      "CODEFORCES",
      "LEETCODE",
      "ATCODER",
      "CODECHEF",
    ] as const) {
      expect(
        extractHandle(platform, getProfileUrl(platform, "some_user")),
      ).toBe("some_user");
    }
  });
});
