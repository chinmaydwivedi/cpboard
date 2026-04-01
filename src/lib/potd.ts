import type { ProblemPlatform, SolutionLanguage } from "@prisma/client";

export const IST_TIME_ZONE = "Asia/Kolkata";
export const MAX_COMMENT_LENGTH = 2000;
export const COMMENT_COOLDOWN_SECONDS = 12;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
});

export const POTD_LANGUAGES: readonly SolutionLanguage[] = [
  "JAVA",
  "CPP",
  "PYTHON",
];

export const PROBLEM_PLATFORM_LABELS: Record<ProblemPlatform, string> = {
  LEETCODE: "LeetCode",
  CODEFORCES: "Codeforces",
  ATCODER: "AtCoder",
  CODECHEF: "CodeChef",
};

export const SOLUTION_LANGUAGE_LABELS: Record<SolutionLanguage, string> = {
  JAVA: "Java",
  CPP: "C++",
  PYTHON: "Python",
};

export type PotdStreakSummary = {
  current: number;
  longest: number;
  totalSolvedDays: number;
  solvedToday: boolean;
  lastSolvedDate: string | null;
};

export type CommentSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language: string | null };

export function isDateKey(value: string): boolean {
  return DATE_KEY_RE.test(value);
}

export function getIstDateKey(date = new Date()): string {
  return IST_DATE_FORMATTER.format(date);
}

export function dateToDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateKeyToUtcDate(dateKey: string): Date | null {
  if (!isDateKey(dateKey)) return null;
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getUtcDayBoundsFromDateKey(dateKey: string): {
  start: Date;
  end: Date;
} | null {
  const start = dateKeyToUtcDate(dateKey);
  if (!start) return null;
  return {
    start,
    end: new Date(start.getTime() + MS_PER_DAY),
  };
}

function keyToDayNumber(dateKey: string): number | null {
  const date = dateKeyToUtcDate(dateKey);
  if (!date) return null;
  return Math.floor(date.getTime() / MS_PER_DAY);
}

export function computePotdStreak(
  solvedDateKeys: string[],
  todayKey = getIstDateKey()
): PotdStreakSummary {
  const unique = [...new Set(solvedDateKeys.filter(isDateKey))].sort();
  if (unique.length === 0) {
    return {
      current: 0,
      longest: 0,
      totalSolvedDays: 0,
      solvedToday: false,
      lastSolvedDate: null,
    };
  }

  const dayNumbers = unique
    .map((key) => keyToDayNumber(key))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dayNumbers.length; i++) {
    if (dayNumbers[i] === dayNumbers[i - 1] + 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }

  const solvedSet = new Set(dayNumbers);
  const todayDay = keyToDayNumber(todayKey);
  let current = 0;

  if (todayDay !== null) {
    for (let day = todayDay; solvedSet.has(day); day -= 1) {
      current += 1;
    }
  }

  return {
    current,
    longest,
    totalSolvedDays: unique.length,
    solvedToday: current > 0,
    lastSolvedDate: unique[unique.length - 1] ?? null,
  };
}

export function normalizeCommentBody(input: string): string {
  return input.replace(/\r\n?/g, "\n").trim();
}

export function parseCommentSegments(input: string): CommentSegment[] {
  const body = input.replace(/\r\n?/g, "\n");
  const segments: CommentSegment[] = [];
  const fenceRe = /```([a-zA-Z0-9#+-]*)\n([\s\S]*?)```/g;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(body)) !== null) {
    const [raw, langRaw, codeRaw] = match;
    const start = match.index;

    if (start > cursor) {
      const text = body.slice(cursor, start).trim();
      if (text) segments.push({ type: "text", value: text });
    }

    const code = codeRaw.trimEnd();
    if (code) {
      const language = langRaw.trim() || null;
      segments.push({ type: "code", value: code, language });
    }

    cursor = start + raw.length;
  }

  if (cursor < body.length) {
    const text = body.slice(cursor).trim();
    if (text) segments.push({ type: "text", value: text });
  }

  if (segments.length === 0 && body.trim()) {
    return [{ type: "text", value: body.trim() }];
  }

  return segments;
}

export function isValidProblemUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
