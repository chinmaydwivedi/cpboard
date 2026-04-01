"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProblemPlatform, SolutionLanguage } from "@prisma/client";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Flame,
  Lock,
  MessageSquare,
  RefreshCw,
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

function formatDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
          <div key={`code-${index}`} className="rounded-md border border-border/60 bg-background/70 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border/50 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
              {segment.language || "code"}
            </div>
            <pre className="overflow-x-auto p-3">
              <code className="font-mono text-[12px] leading-relaxed whitespace-pre">
                {segment.value}
              </code>
            </pre>
          </div>
        );
      })}
    </div>
  );
}

export function PotdClient({
  selectedDateKey,
  viewer,
  streak: initialStreak,
  hasSolvedCurrent,
  problem,
  archive,
  comments: initialComments,
}: {
  selectedDateKey: string | null;
  viewer: { id: string; username: string; name: string | null } | null;
  streak: PotdStreakSummary | null;
  hasSolvedCurrent: boolean;
  problem: PotdProblem | null;
  archive: {
    id: string;
    dateKey: string;
    title: string;
    platform: ProblemPlatform;
    difficulty: string | null;
  }[];
  comments: PotdComment[];
}) {
  const [activeLanguage, setActiveLanguage] = useState<SolutionLanguage | null>(
    problem?.solutions[0]?.language ?? null
  );
  const [markingSolved, setMarkingSolved] = useState(false);
  const [solvedCurrent, setSolvedCurrent] = useState(hasSolvedCurrent);
  const [streak, setStreak] = useState(initialStreak);
  const [comments, setComments] = useState(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [refreshingComments, setRefreshingComments] = useState(false);

  useEffect(() => {
    setActiveLanguage(problem?.solutions[0]?.language ?? null);
    setSolvedCurrent(hasSolvedCurrent);
    setComments(initialComments);
    setStreak(initialStreak);
  }, [problem, hasSolvedCurrent, initialComments, initialStreak]);

  const refreshComments = useCallback(async (silent = false) => {
    if (!problem) return;
    if (!silent) setRefreshingComments(true);

    try {
      const res = await fetch(`/api/daily-practice/${problem.id}/comments`);
      const data = await res.json();
      if (!res.ok) {
        if (!silent) toast.error(data.error || "Failed to refresh comments");
        return;
      }
      setComments(data.comments || []);
    } catch {
      if (!silent) toast.error("Failed to refresh comments");
    } finally {
      if (!silent) setRefreshingComments(false);
    }
  }, [problem]);

  useEffect(() => {
    if (!problem) return;
    const timer = window.setInterval(() => {
      void refreshComments(true);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [problem, refreshComments]);

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
      toast.success("Marked as solved. Nice consistency.");
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-7" data-tour="potd-header">
        <h1 className="text-2xl font-bold tracking-tight">Problem of the Day</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daily practice with editorials and community discussion.
        </p>
      </div>

      {!problem ? (
        <div className="rounded-lg border border-border/60 p-8 text-center">
          <p className="text-base font-medium">No published POTD yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            An admin can publish the first daily practice problem from the admin panel.
          </p>
        </div>
      ) : (
        <>
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
                <p className="text-sm text-muted-foreground mt-2">Sign in to track your streak.</p>
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
                <Button
                  type="button"
                  onClick={handleMarkSolved}
                  disabled={solvedCurrent || markingSolved}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {solvedCurrent
                    ? "Solved"
                    : markingSolved
                      ? "Marking..."
                      : "Mark as solved"}
                </Button>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Sign in to track streak
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
                Sign in to join the discussion and share code snippets.
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
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
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
            <p className="text-sm font-medium mb-3">Archive</p>
            <div className="space-y-2">
              {archive.map((entry) => {
                const selected = selectedDateKey
                  ? selectedDateKey === entry.dateKey
                  : problem.id === entry.id;
                return (
                  <Link
                    key={entry.id}
                    href={`/potd?date=${entry.dateKey}`}
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
