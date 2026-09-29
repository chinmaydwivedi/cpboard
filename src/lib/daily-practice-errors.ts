import type { z } from "zod";

const FIELD_LABELS: Record<string, string> = {
  date: "Date",
  platform: "Platform",
  title: "Title",
  problemUrl: "Problem link",
  difficulty: "Difficulty",
  notes: "Notes",
};

const LANGUAGE_LABELS: Record<string, string> = {
  JAVA: "Java",
  CPP: "C++",
  PYTHON: "Python",
};

/** Turns the first validation issue into a message that names the form field. */
export function describeDailyPracticeIssue(issue: z.core.$ZodIssue | undefined) {
  if (!issue) return "Invalid payload";
  const [first, language, part] = issue.path.map(String);
  const field =
    first === "solutions" && language
      ? `${LANGUAGE_LABELS[language] ?? language} ${part === "explanation" ? "explanation" : "solution"}`
      : (FIELD_LABELS[first] ?? first);
  if (issue.code === "too_small" && issue.origin === "string") {
    return Number(issue.minimum) <= 1
      ? `${field} is required.`
      : `${field} must be at least ${issue.minimum} characters.`;
  }
  return field ? `${field}: ${issue.message}` : issue.message;
}
