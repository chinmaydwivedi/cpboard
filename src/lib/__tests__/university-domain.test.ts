import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { normalizeEmailAddress, normalizeEmailDomain } = await import(
  "@/lib/university-domain"
);

describe("normalizeEmailAddress", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmailAddress("  Student@PESU.PES.edu ")).toBe(
      "student@pesu.pes.edu",
    );
  });

  it.each(["", "no-at-sign", "a@b@c.com", "has space@x.com", `${"a".repeat(250)}@x.com`])(
    "rejects %j",
    (value) => {
      expect(normalizeEmailAddress(value)).toBeNull();
    },
  );
});

describe("normalizeEmailDomain", () => {
  it("lowercases and strips a trailing dot", () => {
    expect(normalizeEmailDomain("PESU.PES.EDU.")).toBe("pesu.pes.edu");
  });

  it.each(["localhost", "-bad.edu", "bad-.edu", "exa mple.edu", "x.c"])(
    "rejects %j",
    (value) => {
      expect(normalizeEmailDomain(value)).toBeNull();
    },
  );
});
