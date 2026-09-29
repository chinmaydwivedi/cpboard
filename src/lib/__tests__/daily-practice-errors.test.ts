import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeDailyPracticeIssue } from "@/lib/daily-practice-errors";

const schema = z.object({
  title: z.string().trim().min(3),
  problemUrl: z.string().refine(() => false, "Use a supported platform HTTPS problem link"),
  solutions: z.object({
    CPP: z.object({ code: z.string().trim().min(1) }),
  }),
});

const firstIssue = (payload: unknown) => schema.safeParse(payload).error?.issues[0];

describe("describeDailyPracticeIssue", () => {
  it("names the missing solution language", () => {
    const issue = schema.shape.solutions.safeParse({ CPP: { code: "" } }).error?.issues[0];
    expect(describeDailyPracticeIssue(issue && { ...issue, path: ["solutions", ...issue.path] })).toBe(
      "C++ solution is required.",
    );
  });

  it("states the minimum length for short fields", () => {
    expect(describeDailyPracticeIssue(firstIssue({ title: "ab", problemUrl: "x", solutions: { CPP: { code: "x" } } }))).toBe(
      "Title must be at least 3 characters.",
    );
  });

  it("prefixes custom messages with the field", () => {
    expect(describeDailyPracticeIssue(firstIssue({ title: "Two Sum", problemUrl: "x", solutions: { CPP: { code: "x" } } }))).toBe(
      "Problem link: Use a supported platform HTTPS problem link",
    );
  });

  it("falls back when there is no issue", () => {
    expect(describeDailyPracticeIssue(undefined)).toBe("Invalid payload");
  });
});
