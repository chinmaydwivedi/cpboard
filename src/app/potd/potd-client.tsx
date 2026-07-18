"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProblemPlatform, SolutionLanguage } from "@prisma/client";
import { toast } from "sonner";
import {
  Check,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Lock,
  MessageSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  parseCommentSegments,
  PROBLEM_PLATFORM_LABELS,
  SOLUTION_LANGUAGE_LABELS,
  type PotdStreakSummary,
} from "@/lib/potd";

type PotdSolution = {
  language: SolutionLanguage;
  code: string;
  explanation: string | null;
};

type PotdProblem = {
  id: string;
  dateKey: string;
  platform: ProblemPlatform;
  title: string;
  problemUrl: string;
  difficulty: string | null;
  notes: string | null;
  isToday: boolean;
  solutions: PotdSolution[];
};

type PotdComment = {
  id: string;
  body: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

type PotdArchiveEntry = {
  id: string;
  dateKey: string;
  title: string;
  platform: ProblemPlatform;
  difficulty: string | null;
};

type HighlightTokenType =
  | "plain"
  | "keyword"
  | "type"
  | "string"
  | "number"
  | "comment";

type HighlightToken = {
  text: string;
  type: HighlightTokenType;
};

const LANGUAGE_KEYWORDS: Record<string, Set<string>> = {
  cpp: new Set([
    "if", "else", "for", "while", "return", "class", "public", "private",
    "protected", "switch", "case", "break", "continue", "try", "catch",
    "const", "static", "new", "delete", "using", "namespace", "template",
    "typename", "auto", "this", "true", "false", "nullptr",
  ]),
  java: new Set([
    "if", "else", "for", "while", "return", "class", "public", "private",
    "protected", "switch", "case", "break", "continue", "try", "catch",
    "new", "this", "static", "final", "true", "false", "null", "package",
    "import", "extends", "implements", "throws", "throw",
  ]),
  python: new Set([
    "if", "elif", "else", "for", "while", "return", "def", "class", "import",
    "from", "as", "try", "except", "finally", "with", "pass", "break",
    "continue", "lambda", "in", "is", "not", "and", "or", "True", "False",
    "None",
  ]),
};

const LANGUAGE_TYPES: Record<string, Set<string>> = {
  cpp: new Set([
    "int", "long", "bool", "char", "double", "float", "void", "string",
    "vector", "map", "set", "unordered_map", "unordered_set", "pair",
    "size_t",
  ]),
  java: new Set([
    "int", "long", "boolean", "char", "double", "float", "void", "String",
    "List", "ArrayList", "Map", "HashMap", "Set", "HashSet", "Integer",
    "Long",
  ]),
  python: new Set(["int", "float", "bool", "str", "list", "dict", "set", "tuple"]),
};
const ARCHIVE_PAGE_SIZE = 5;

function formatDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateKey.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${(month + 1)
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    if (day < 1 || day > daysInMonth) return null;
    return {
      day,
      dateKey: dateKeyFromParts(year, month, day),
    };
  });
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function findArchivePageIndex(
  archive: PotdArchiveEntry[],
  selectedDateKey: string | null,
  currentProblemId: string | null
): number {
  if (archive.length === 0) return 0;

  if (selectedDateKey) {
    const dateMatch = archive.findIndex((entry) => entry.dateKey === selectedDateKey);
    if (dateMatch >= 0) return Math.floor(dateMatch / ARCHIVE_PAGE_SIZE);
  }

  if (currentProblemId) {
    const problemMatch = archive.findIndex((entry) => entry.id === currentProblemId);
    if (problemMatch >= 0) return Math.floor(problemMatch / ARCHIVE_PAGE_SIZE);
  }

  return 0;
}

function normalizeLanguage(language: string | null): string {
  const value = (language || "").trim().toLowerCase();
  if (!value) return "text";
  if (value === "cpp" || value === "c++" || value === "cc") return "cpp";
  if (value === "py" || value === "python3") return "python";
  if (value === "javascript" || value === "js") return "javascript";
  if (value === "ts" || value === "typescript") return "typescript";
  return value;
}

function tokenClassName(type: HighlightTokenType) {
  if (type === "keyword") return "text-fuchsia-400";
  if (type === "type") return "text-emerald-300";
  if (type === "string") return "text-amber-300";
  if (type === "number") return "text-cyan-300";
  if (type === "comment") return "text-zinc-500 italic";
  return "text-zinc-100";
}

function tokenizeCodeLine(line: string, language: string): HighlightToken[] {
  const keywordSet = LANGUAGE_KEYWORDS[language] ?? new Set<string>();
  const typeSet = LANGUAGE_TYPES[language] ?? new Set<string>();
  const tokens: HighlightToken[] = [];

  let cursor = 0;
  let commentStart = -1;
  if (language === "python") {
    commentStart = line.indexOf("#");
  } else {
    commentStart = line.indexOf("//");
  }

  const parseUntil = commentStart >= 0 ? commentStart : line.length;

  while (cursor < parseUntil) {
    const char = line[cursor];

    if (char === '"' || char === "'") {
      const quote = char;
      let end = cursor + 1;
      while (end < parseUntil) {
        if (line[end] === quote && line[end - 1] !== "\\") {
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push({ text: line.slice(cursor, end), type: "string" });
      cursor = end;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let end = cursor + 1;
      while (end < parseUntil && /[0-9._]/.test(line[end])) end += 1;
      tokens.push({ text: line.slice(cursor, end), type: "number" });
      cursor = end;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = cursor + 1;
      while (end < parseUntil && /[A-Za-z0-9_]/.test(line[end])) end += 1;
      const word = line.slice(cursor, end);
      if (keywordSet.has(word)) {
        tokens.push({ text: word, type: "keyword" });
      } else if (typeSet.has(word)) {
        tokens.push({ text: word, type: "type" });
      } else {
        tokens.push({ text: word, type: "plain" });
      }
      cursor = end;
      continue;
    }

    tokens.push({ text: char, type: "plain" });
    cursor += 1;
  }

  if (commentStart >= 0) {
    tokens.push({ text: line.slice(commentStart), type: "comment" });
  }

  return tokens;
}

function CodeSurface({ code, language }: { code: string; language: string | null }) {
  const normalized = normalizeLanguage(language);
  const lines = useMemo(() => code.replace(/\r\n?/g, "\n").split("\n"), [code]);

  return (
    <div className="rounded-md border border-zinc-700/70 bg-[#0b0d12] overflow-hidden">
      <div className="border-b border-zinc-700/60 px-3 py-1.5 bg-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-500/70" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wide text-zinc-400">
          {normalized}
        </span>
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-[12px] leading-relaxed whitespace-pre">
          {lines.map((line, lineIndex) => {
            const tokens = tokenizeCodeLine(line, normalized);
            return (
              <span key={`line-${lineIndex}`} className="block">
                {tokens.map((token, tokenIndex) => (
                  <span
                    key={`token-${lineIndex}-${tokenIndex}`}
                    className={tokenClassName(token.type)}
                  >
                    {token.text}
                  </span>
                ))}
                {lineIndex < lines.length - 1 ? "\n" : ""}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

function CommentBody({ body }: { body: string }) {
  const segments = useMemo(() => parseCommentSegments(body), [body]);

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <p
              key={`text-${index}`}
              className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap"
            >
              {segment.value}
            </p>
          );
        }

        return (
          <CodeSurface
            key={`code-${index}`}
            code={segment.value}
            language={segment.language}
          />
        );
      })}
    </div>
  );
}

export function PotdClient({
  todayKey,
  selectedDateKey,
  viewer,
  streak: initialStreak,
  solvedDateKeys,
  publishedDateKeys,
  hasSolvedCurrent,
  problem,
  archive,
  comments: initialComments,
}: {
  todayKey: string;
  selectedDateKey: string | null;
  viewer: { id: string; username: string; name: string | null } | null;
  streak: PotdStreakSummary | null;
  solvedDateKeys: string[];
  publishedDateKeys: string[];
  hasSolvedCurrent: boolean;
  problem: PotdProblem | null;
  archive: PotdArchiveEntry[];
  comments: PotdComment[];
}) {
  const router = useRouter();
  const [isDateTransitionPending, startDateTransition] = useTransition();
  const commentsRequestRef = useRef<AbortController | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<SolutionLanguage | null>(
    problem?.solutions[0]?.language ?? null
  );
  const [markingSolved, setMarkingSolved] = useState(false);
  const [solvedCurrent, setSolvedCurrent] = useState(hasSolvedCurrent);
  const [streak, setStreak] = useState(initialStreak);
  const [comments, setComments] = useState(initialComments);
  const [localSolvedDates, setLocalSolvedDates] = useState(solvedDateKeys);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [refreshingComments, setRefreshingComments] = useState(false);
  const [archivePage, setArchivePage] = useState(() =>
    findArchivePageIndex(archive, selectedDateKey, problem?.id ?? null)
  );
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const seed = selectedDateKey ?? problem?.dateKey ?? todayKey;
    const parsed = parseDateKey(seed);
    return { year: parsed.year, month: parsed.month };
  });

  useEffect(() => {
    setActiveLanguage(problem?.solutions[0]?.language ?? null);
    setSolvedCurrent(hasSolvedCurrent);
    setComments(initialComments);
    setStreak(initialStreak);
    setLocalSolvedDates(solvedDateKeys);
    const seed = selectedDateKey ?? problem?.dateKey ?? todayKey;
    const parsed = parseDateKey(seed);
    setCalendarMonth({ year: parsed.year, month: parsed.month });
  }, [
    problem,
    hasSolvedCurrent,
    initialComments,
    initialStreak,
    solvedDateKeys,
    selectedDateKey,
    todayKey,
  ]);

  useEffect(() => {
    setArchivePage(findArchivePageIndex(archive, selectedDateKey, problem?.id ?? null));
  }, [archive, selectedDateKey, problem?.id]);

  const goToDate = useCallback(
    (dateKey: string) => {
      startDateTransition(() => {
        router.push(`/potd?date=${dateKey}`, { scroll: false });
      });
    },
    [router]
  );

  const refreshComments = useCallback(async (silent = false) => {
    if (!problem) return;
    if (!silent) setRefreshingComments(true);
    commentsRequestRef.current?.abort();
    const controller = new AbortController();
    commentsRequestRef.current = controller;

    try {
      const res = await fetch(`/api/daily-practice/${problem.id}/comments`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        if (!silent) toast.error(data.error || "Failed to refresh comments");
        return;
      }
      setComments(data.comments || []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!silent) toast.error("Failed to refresh comments");
    } finally {
      if (commentsRequestRef.current === controller) {
        commentsRequestRef.current = null;
      }
      if (!silent) setRefreshingComments(false);
    }
  }, [problem]);

  useEffect(() => {
    if (!problem) return;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshComments(true);
      }
    };
    const timer = window.setInterval(() => {
      refreshIfVisible();
    }, 20000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      commentsRequestRef.current?.abort();
    };
  }, [problem, refreshComments]);

  useEffect(() => {
    if (!problem) return;

    const ordered = [...new Set([problem.dateKey, ...archive.map((entry) => entry.dateKey)])]
      .sort((a, b) => b.localeCompare(a));
    const index = ordered.indexOf(problem.dateKey);
    if (index < 0) return;

    const adjacentDateKeys = [ordered[index - 1], ordered[index + 1]].filter(
      (value): value is string => typeof value === "string"
    );
    for (const dateKey of adjacentDateKeys) {
      router.prefetch(`/potd?date=${dateKey}`);
    }
  }, [archive, problem, router]);

  const handleMarkSolved = async () => {
    if (!problem || !viewer || solvedCurrent || markingSolved) return;
    setMarkingSolved(true);
    try {
      const res = await fetch("/api/potd/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to mark problem as solved");
        return;
      }

      setSolvedCurrent(true);
      if (data.streak) {
        setStreak(data.streak);
      }
      setLocalSolvedDates((prev) =>
        prev.includes(problem.dateKey) ? prev : [...prev, problem.dateKey]
      );
      if (data.source) {
        const sourceLabel = data.source === "LEETCODE" ? "LeetCode" : "Codeforces";
        toast.success(`Verified from ${sourceLabel} and marked solved.`);
      } else {
        toast.success("Marked as solved.");
      }
    } catch {
      toast.error("Failed to mark problem as solved");
    } finally {
      setMarkingSolved(false);
    }
  };

  const handlePostComment = async () => {
    if (!problem || !viewer || postingComment) return;
    if (!commentBody.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    setPostingComment(true);
    try {
      const res = await fetch(`/api/daily-practice/${problem.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to post comment");
        return;
      }

      const nextComment = data.comment as PotdComment | undefined;
      if (nextComment) {
        setComments((prev) => [...prev, nextComment]);
      }
      setCommentBody("");
      toast.success("Comment posted");
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!problem || !viewer || deletingCommentId) return;
    setDeletingCommentId(commentId);
    try {
      const res = await fetch(`/api/daily-practice/${problem.id}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete comment");
        return;
      }
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const solvedDateSet = useMemo(
    () => new Set(localSolvedDates),
    [localSolvedDates]
  );
  const publishedDateSet = useMemo(() => {
    const merged = new Set(publishedDateKeys);
    if (problem?.dateKey) merged.add(problem.dateKey);
    return merged;
  }, [publishedDateKeys, problem?.dateKey]);
  const calendarCells = useMemo(
    () => buildCalendarCells(calendarMonth.year, calendarMonth.month),
    [calendarMonth]
  );
  const totalArchivePages = Math.max(1, Math.ceil(archive.length / ARCHIVE_PAGE_SIZE));
  const clampedArchivePage = Math.min(archivePage, totalArchivePages - 1);
  const pagedArchive = useMemo(() => {
    const start = clampedArchivePage * ARCHIVE_PAGE_SIZE;
    return archive.slice(start, start + ARCHIVE_PAGE_SIZE);
  }, [archive, clampedArchivePage]);

  useEffect(() => {
    if (archivePage === clampedArchivePage) return;
    setArchivePage(clampedArchivePage);
  }, [archivePage, clampedArchivePage]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-7" data-tour="potd-header">
        <h1 className="text-2xl font-bold tracking-tight">Problem of the Day</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daily practice with editorials and community discussion.
        </p>
      </div>

      {!viewer ? (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium">Sign up first to track POTD progress.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create an account to mark POTD as solved, join discussions, and build your streak.
          </p>
          <Link
            href="/login"
            className="inline-flex mt-2 text-xs font-medium text-primary hover:underline"
          >
            Go to sign up / login
          </Link>
        </div>
      ) : null}

      {!problem ? (
        <div className="rounded-lg border border-border/60 p-8 text-center">
          <p className="text-base font-medium">No published POTD yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            An admin can publish the first daily practice problem from the admin panel.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-border/60 p-5 mb-6" data-tour="potd-calendar">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <p className="text-sm font-medium">POTD Calendar</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tick marks show days you completed POTD.
                </p>
                {isDateTransitionPending ? (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Loading selected day...
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setCalendarMonth((prev) => {
                      const month = prev.month - 1;
                      if (month < 0) return { year: prev.year - 1, month: 11 };
                      return { year: prev.year, month };
                    })
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setCalendarMonth((prev) => {
                      const month = prev.month + 1;
                      if (month > 11) return { year: prev.year + 1, month: 0 };
                      return { year: prev.year, month };
                    })
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-sm font-medium mb-3">
              {monthLabel(calendarMonth.year, calendarMonth.month)}
            </p>

            <div className="grid grid-cols-7 gap-1.5 text-[11px] text-muted-foreground mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="h-8 flex items-center justify-center font-medium"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="h-9 rounded-md" />;
                }

                const isSolved = solvedDateSet.has(cell.dateKey);
                const isToday = cell.dateKey === todayKey;
                const isProblemDay = problem ? cell.dateKey === problem.dateKey : false;
                const isPublishedDay = publishedDateSet.has(cell.dateKey);

                return (
                  <button
                    type="button"
                    key={cell.dateKey}
                    onClick={() => {
                      if (!isPublishedDay) return;
                      goToDate(cell.dateKey);
                    }}
                    onMouseEnter={() => {
                      if (!isPublishedDay) return;
                      router.prefetch(`/potd?date=${cell.dateKey}`);
                    }}
                    disabled={!isPublishedDay}
                    className={`h-9 rounded-md border flex items-center justify-center text-sm relative transition-colors ${
                      isSolved
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : isPublishedDay
                          ? "border-border/60 text-muted-foreground hover:bg-secondary/30"
                          : "border-border/35 text-muted-foreground/45"
                    } ${isToday ? "ring-1 ring-primary/40" : ""} ${
                      isProblemDay ? "font-semibold" : ""
                    }`}
                    title={
                      isPublishedDay
                        ? `${cell.dateKey} (Open POTD)`
                        : `${cell.dateKey} (No POTD published)`
                    }
                  >
                    {cell.day}
                    {isSolved ? (
                      <Check className="h-3 w-3 absolute top-1 right-1 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3 mb-6" data-tour="potd-streak">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                <CalendarDays className="h-3.5 w-3.5" /> Active Problem
              </div>
              <p className="text-sm font-medium mt-2">{formatDate(problem.dateKey)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {problem.isToday ? "Today’s POTD" : "Recent published POTD"}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                <Flame className="h-3.5 w-3.5" /> Current Streak
              </div>
              {viewer ? (
                <>
                  <p className="text-2xl font-bold font-mono mt-1">
                    {streak?.current ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Longest: {streak?.longest ?? 0} days
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  Sign up first to track your streak.
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                <MessageSquare className="h-3.5 w-3.5" /> Discussion
              </div>
              <p className="text-2xl font-bold font-mono mt-1">{comments.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Messages on this problem
              </p>
            </div>
          </div>

          <section className="rounded-lg border border-border/60 p-5 mb-6" data-tour="potd-problem">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className="font-mono text-[10px]">
                {PROBLEM_PLATFORM_LABELS[problem.platform]}
              </Badge>
              {problem.isToday && (
                <Badge className="bg-primary text-primary-foreground">Today</Badge>
              )}
              {problem.difficulty ? (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {problem.difficulty}
                </Badge>
              ) : null}
            </div>

            <h2 className="text-xl font-semibold leading-tight">{problem.title}</h2>
            <a
              href={problem.problemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
            >
              Open problem link <ExternalLink className="h-3.5 w-3.5" />
            </a>

            {problem.notes ? (
              <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{problem.notes}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {viewer ? (
                <>
                  <Button
                    type="button"
                    onClick={handleMarkSolved}
                    disabled={solvedCurrent || markingSolved}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    {solvedCurrent
                      ? "Solved"
                      : markingSolved
                        ? "Verifying..."
                        : "Mark as solved"}
                  </Button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Sign up first for POTD
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border/60 p-5 mb-6" data-tour="potd-solutions">
            <p className="text-sm font-medium mb-3">Admin Solutions</p>
            {problem.solutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Solutions will be added soon.</p>
            ) : (
              <Tabs
                value={activeLanguage ?? undefined}
                onValueChange={(value) =>
                  setActiveLanguage((value as SolutionLanguage | null) ?? null)
                }
              >
                <TabsList>
                  {problem.solutions.map((solution) => (
                    <TabsTrigger key={solution.language} value={solution.language}>
                      {SOLUTION_LANGUAGE_LABELS[solution.language]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {problem.solutions.map((solution) => (
                  <TabsContent key={solution.language} value={solution.language} className="mt-3">
                    {solution.explanation ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">
                        {solution.explanation}
                      </p>
                    ) : null}
                    <div className="rounded-lg border border-border/60 bg-background/70 overflow-hidden">
                      <div className="px-3 py-1.5 border-b border-border/50 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                        {SOLUTION_LANGUAGE_LABELS[solution.language]}
                      </div>
                      <pre className="overflow-x-auto p-3">
                        <code className="font-mono text-[12px] leading-relaxed whitespace-pre">
                          {solution.code}
                        </code>
                      </pre>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </section>

          <section className="rounded-lg border border-border/60 p-5 mb-6" data-tour="potd-comments">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-medium">Discussion</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => refreshComments(false)}
                disabled={refreshingComments}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${refreshingComments ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {viewer ? (
              <div className="mb-4">
                <Textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder={"Share your approach. Use ```cpp, ```java, or ```python for code blocks."}
                  className="min-h-24 text-sm"
                  maxLength={2000}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Keep it focused and constructive.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePostComment}
                    disabled={postingComment}
                  >
                    {postingComment ? "Posting..." : "Post comment"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 mb-4 text-sm text-muted-foreground">
                Sign up first to join the discussion and share code snippets.
              </div>
            )}

            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary">
                        {(comment.user.name || comment.user.username)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium leading-tight">
                          {comment.user.name || comment.user.username}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          @{comment.user.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                      {viewer?.id === comment.user.id ? (
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            void handleDeleteComment(comment.id);
                          }}
                          disabled={deletingCommentId === comment.id}
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <CommentBody body={comment.body} />
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet. Start the discussion.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border/60 p-5" data-tour="potd-archive">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Archive</p>
              {archive.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setArchivePage((prev) => Math.max(0, prev - 1))}
                    disabled={clampedArchivePage === 0}
                  >
                    Prev
                  </Button>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {clampedArchivePage + 1}/{totalArchivePages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setArchivePage((prev) => Math.min(totalArchivePages - 1, prev + 1))
                    }
                    disabled={clampedArchivePage >= totalArchivePages - 1}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              {pagedArchive.map((entry) => {
                const selected = selectedDateKey
                  ? selectedDateKey === entry.dateKey
                  : problem.id === entry.id;
                return (
                  <Link
                    key={entry.id}
                    href={`/potd?date=${entry.dateKey}`}
                    prefetch
                    onMouseEnter={() => {
                      router.prefetch(`/potd?date=${entry.dateKey}`);
                    }}
                    className={`block rounded-md border px-3 py-2 transition-colors ${
                      selected
                        ? "border-primary/40 bg-primary/8"
                        : "border-border/60 hover:bg-secondary/30"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{entry.title}</p>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatDate(entry.dateKey)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{PROBLEM_PLATFORM_LABELS[entry.platform]}</span>
                      {entry.difficulty ? <span>• {entry.difficulty}</span> : null}
                    </div>
                  </Link>
                );
              })}
              {archive.length === 0 && (
                <p className="text-sm text-muted-foreground">No archived POTD entries yet.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
