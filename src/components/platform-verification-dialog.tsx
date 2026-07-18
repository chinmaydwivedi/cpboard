"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type VerificationPlatform = "CODEFORCES" | "LEETCODE";

export type PlatformVerificationData = {
  handle: string;
  rating: number;
  maxRating: number;
  problemsSolved: number;
  rank: string | null;
  contestsCount: number;
  statsPending?: boolean;
};

export type PlatformVerificationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: VerificationPlatform;
  handle: string;
  onVerified: (data: PlatformVerificationData) => void;
};

type VerificationChallenge = {
  platform: VerificationPlatform;
  handle: string;
  problemTitle: string;
  problemUrl: string;
  instruction: string;
  expiresAt: string;
  checkUntil: string;
  serverNow: string;
  requiredVerdict: string;
};

type Phase = "idle" | "starting" | "active" | "checking" | "verified" | "error";

type Notice = {
  kind: "info" | "error";
  text: string;
};

const PLATFORM_LABELS: Record<VerificationPlatform, string> = {
  CODEFORCES: "Codeforces",
  LEETCODE: "LeetCode",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isProviderProblemUrl(
  platform: VerificationPlatform,
  value: string,
): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    return platform === "CODEFORCES"
      ? hostname === "codeforces.com" || hostname === "www.codeforces.com"
      : hostname === "leetcode.com" || hostname === "www.leetcode.com";
  } catch {
    return false;
  }
}

function parseChallenge(payload: unknown): VerificationChallenge | null {
  const challenge = asRecord(asRecord(payload)?.challenge);
  if (!challenge) return null;

  const platform = challenge.platform;
  const handle = challenge.handle;
  const problemTitle = challenge.problemTitle;
  const problemUrl = challenge.problemUrl;
  const instruction = challenge.instruction;
  const expiresAt = challenge.expiresAt;
  const checkUntil = challenge.checkUntil;
  const serverNow = challenge.serverNow;
  const requiredVerdict = challenge.requiredVerdict;

  if (
    (platform !== "CODEFORCES" && platform !== "LEETCODE") ||
    typeof handle !== "string" ||
    typeof problemTitle !== "string" ||
    typeof problemUrl !== "string" ||
    typeof instruction !== "string" ||
    typeof expiresAt !== "string" ||
    typeof checkUntil !== "string" ||
    typeof serverNow !== "string" ||
    typeof requiredVerdict !== "string" ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    !Number.isFinite(Date.parse(checkUntil)) ||
    !Number.isFinite(Date.parse(serverNow)) ||
    !isProviderProblemUrl(platform, problemUrl)
  ) {
    return null;
  }

  return {
    platform,
    handle,
    problemTitle,
    problemUrl,
    instruction,
    expiresAt,
    checkUntil,
    serverNow,
    requiredVerdict,
  };
}

function parseVerificationData(payload: unknown): PlatformVerificationData | null {
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  if (record?.verified !== true || !data) return null;

  const handle = data.handle;
  const rating = data.rating;
  const maxRating = data.maxRating;
  const problemsSolved = data.problemsSolved;
  const rank = data.rank;
  const contestsCount = data.contestsCount;

  if (
    typeof handle !== "string" ||
    typeof rating !== "number" ||
    typeof maxRating !== "number" ||
    typeof problemsSolved !== "number" ||
    (typeof rank !== "string" && rank !== null) ||
    typeof contestsCount !== "number"
  ) {
    return null;
  }

  return {
    handle,
    rating,
    maxRating,
    problemsSolved,
    rank,
    contestsCount,
    statsPending: record.statsPending === true,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function responseMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  return typeof record?.error === "string"
    ? record.error
    : typeof record?.message === "string"
      ? record.message
      : fallback;
}

function responseCode(payload: unknown): string | null {
  const code = asRecord(payload)?.code;
  return typeof code === "string" ? code : null;
}

function formatRemaining(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatVerdict(verdict: string): string {
  return verdict
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function PlatformVerificationDialog({
  open,
  onOpenChange,
  platform,
  handle,
  onVerified,
}: PlatformVerificationDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [verifiedData, setVerifiedData] = useState<PlatformVerificationData | null>(null);
  const [serverExpired, setServerExpired] = useState(false);
  const [serverClockOffset, setServerClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const requestRef = useRef<AbortController | null>(null);
  const openKeyRef = useRef<string | null>(null);
  const challengeHeadingRef = useRef<HTMLParagraphElement | null>(null);
  const verifiedStatusRef = useRef<HTMLDivElement | null>(null);
  const focusedChallengeRef = useRef<string | null>(null);

  const platformLabel = PLATFORM_LABELS[platform];

  const beginRequest = useCallback(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    return controller;
  }, []);

  const startChallenge = useCallback(async () => {
    const trimmedHandle = handle.trim();
    if (!trimmedHandle) {
      setChallenge(null);
      setPhase("error");
      setNotice({ kind: "error", text: `Enter a ${platformLabel} handle first.` });
      return;
    }

    const controller = beginRequest();
    setPhase("starting");
    setChallenge(null);
    setNotice(null);
    setVerifiedData(null);
    setServerExpired(false);
    setNow(Date.now());

    try {
      const response = await fetch("/api/platforms/verification/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: trimmedHandle }),
        signal: controller.signal,
      });
      const payload = await readJson(response);
      if (controller.signal.aborted) return;

      if (!response.ok) {
        setPhase("error");
        setNotice({
          kind: "error",
          text: responseMessage(payload, "Could not prepare a verification challenge."),
        });
        return;
      }

      const nextChallenge = parseChallenge(payload);
      if (!nextChallenge || nextChallenge.platform !== platform) {
        setPhase("error");
        setNotice({
          kind: "error",
          text: "The verification service returned an invalid challenge. Please try again.",
        });
        return;
      }

      setChallenge(nextChallenge);
      const receivedAt = Date.now();
      setServerClockOffset(Date.parse(nextChallenge.serverNow) - receivedAt);
      setNow(receivedAt);
      setPhase("active");
      setNotice({
        kind: "info",
        text: "Challenge ready. Submit from the account you want to verify, then check it here.",
      });
    } catch (error) {
      if (isAbortError(error)) return;
      setPhase("error");
      setNotice({
        kind: "error",
        text: "Could not reach the verification service. Check your connection and try again.",
      });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [beginRequest, handle, platform, platformLabel]);

  useEffect(() => {
    if (!open) {
      requestRef.current?.abort();
      requestRef.current = null;
      openKeyRef.current = null;
      return;
    }

    const openKey = `${platform}:${handle.trim()}`;
    if (openKeyRef.current === openKey) return;
    openKeyRef.current = openKey;
    if (
      challenge?.platform === platform &&
      challenge.handle.toLowerCase() === handle.trim().toLowerCase() &&
      Date.parse(challenge.checkUntil) > Date.now() + serverClockOffset &&
      phase !== "verified"
    ) {
      setPhase("active");
      setNow(Date.now());
      return;
    }
    void startChallenge();
  }, [challenge, handle, open, phase, platform, serverClockOffset, startChallenge]);

  useEffect(() => {
    if (!open || !challenge || phase === "verified") return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [challenge, open, phase]);

  useEffect(() => {
    if (!open || !challenge || phase !== "active") return;

    const challengeKey = `${challenge.platform}:${challenge.handle}:${challenge.expiresAt}`;
    if (focusedChallengeRef.current === challengeKey) return;
    focusedChallengeRef.current = challengeKey;
    challengeHeadingRef.current?.focus();
  }, [challenge, open, phase]);

  useEffect(() => {
    if (open && phase === "verified") verifiedStatusRef.current?.focus();
  }, [open, phase]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      openKeyRef.current = null;
    },
    [],
  );

  const serverNow = now + serverClockOffset;
  const submissionWindowClosed = Boolean(
    challenge && Date.parse(challenge.expiresAt) <= serverNow,
  );
  const isExpired = Boolean(
    challenge && (serverExpired || Date.parse(challenge.checkUntil) <= serverNow),
  );
  const remaining = useMemo(
    () =>
      challenge
        ? formatRemaining(
            submissionWindowClosed ? challenge.checkUntil : challenge.expiresAt,
            serverNow,
          )
        : "00:00",
    [challenge, serverNow, submissionWindowClosed],
  );
  const timerLabel = isExpired
    ? "Challenge expired"
    : submissionWindowClosed
      ? `${remaining} remaining to check a submission made before the deadline`
      : `${remaining} remaining to submit`;

  const checkSubmission = async () => {
    if (!challenge || isExpired || phase === "checking") return;

    const controller = beginRequest();
    setPhase("checking");
    setNotice({ kind: "info", text: "Checking your latest submission…" });

    try {
      const response = await fetch("/api/platforms/verification/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
        signal: controller.signal,
      });
      const payload = await readJson(response);
      if (controller.signal.aborted) return;

      if (!response.ok) {
        const code = responseCode(payload)?.toUpperCase() ?? "";
        if (response.status === 410 || code.includes("EXPIRED")) {
          setServerExpired(true);
          setPhase("active");
          setNotice(null);
          return;
        }

        setPhase("active");
        setNotice({
          kind: "error",
          text: responseMessage(payload, "Could not check the submission right now."),
        });
        return;
      }

      const data = parseVerificationData(payload);
      if (data) {
        setVerifiedData(data);
        setPhase("verified");
        setNotice(null);
        onVerified(data);
        return;
      }

      const record = asRecord(payload);
      if (record?.verified === false && record.pending === true) {
        const nextExpiresAt = record.expiresAt;
        const nextCheckUntil = record.checkUntil;
        const nextServerNow = record.serverNow;
        if (
          typeof nextExpiresAt === "string" &&
          Number.isFinite(Date.parse(nextExpiresAt))
        ) {
          setChallenge((current) =>
            current
              ? {
                  ...current,
                  expiresAt: nextExpiresAt,
                  checkUntil:
                    typeof nextCheckUntil === "string" &&
                    Number.isFinite(Date.parse(nextCheckUntil))
                      ? nextCheckUntil
                      : current.checkUntil,
                }
              : current,
          );
        }
        const receivedAt = Date.now();
        if (
          typeof nextServerNow === "string" &&
          Number.isFinite(Date.parse(nextServerNow))
        ) {
          setServerClockOffset(Date.parse(nextServerNow) - receivedAt);
        }
        setNow(receivedAt);
        setPhase("active");
        setNotice({
          kind: "info",
          text: responseMessage(
            payload,
            "No matching submission yet. Submit it, wait a few seconds, then check again.",
          ),
        });
        return;
      }

      setPhase("active");
      setNotice({
        kind: "error",
        text: "The verification service returned an unexpected response. Please try again.",
      });
    } catch (error) {
      if (isAbortError(error)) return;
      setPhase("active");
      setNotice({
        kind: "error",
        text: "Could not check your submission. Check your connection and try again.",
      });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      requestRef.current?.abort();
      requestRef.current = null;
      openKeyRef.current = null;
      focusedChallengeRef.current = null;
    }
    onOpenChange(nextOpen);
  };

  const retryChallenge = () => {
    openKeyRef.current = `${platform}:${handle.trim()}`;
    void startChallenge();
  };

  const privacyCopy =
    platform === "CODEFORCES"
      ? "CPBoard checks only the submitted problem, verdict, and time. Your source code is never fetched."
      : "CPBoard checks only the public accepted-submission entry and its time. Your source code is never fetched.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border border-border/70 bg-card/95 p-0 backdrop-blur-xl sm:max-w-md">
        <div className="border-b border-border/50 bg-linear-to-br from-primary/12 via-card to-card px-5 py-4">
          <DialogHeader className="gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <Badge variant="outline" className="border-primary/30 font-mono text-[10px] text-primary">
                Ownership check
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                {platformLabel}
              </Badge>
            </div>
            <DialogTitle className="text-lg font-semibold">
              Verify your {platformLabel} handle
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Prove that <span className="font-mono text-foreground">@{challenge?.handle ?? handle.trim()}</span>{" "}
              belongs to you with one submission. The challenge is open for five minutes.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {(phase === "idle" || phase === "starting") && (
            <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-border/60 bg-background/50 px-5 text-center" role="status" aria-live="polite">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Preparing your challenge</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Checking the handle and taking a fresh submission snapshot…
                </p>
              </div>
            </div>
          )}

          {phase === "error" && !challenge && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Challenge unavailable</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {notice?.text ?? "Could not prepare the challenge."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {phase === "verified" && verifiedData && (
            <div
              ref={verifiedStatusRef}
              className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-5 text-center outline-none"
              role="status"
              aria-live="polite"
              tabIndex={-1}
            >
              <span className="flex size-11 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold">Handle verified</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                <span className="font-mono text-foreground">@{verifiedData.handle}</span> is now linked to your CPBoard account.
              </p>
              {verifiedData.statsPending && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Ownership is saved. The provider was busy, so use Sync once it is available to refresh the stats.
                </p>
              )}
            </div>
          )}

          {challenge && phase !== "verified" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                    Required: {formatVerdict(challenge.requiredVerdict)}
                  </Badge>
                </div>
                <div
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums",
                    isExpired
                      ? "text-destructive"
                      : submissionWindowClosed
                        ? "text-amber-500"
                        : "text-muted-foreground",
                  )}
                  role="timer"
                  aria-label={timerLabel}
                >
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {submissionWindowClosed && !isExpired ? "Grace " : ""}
                  {remaining}
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/55 p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Assigned problem
                </p>
                <p
                  ref={challengeHeadingRef}
                  className="mt-1.5 break-words text-sm font-semibold outline-none"
                  tabIndex={-1}
                >
                  {challenge.problemTitle}
                </p>
                <a
                  href={challenge.problemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex max-w-full items-center gap-1.5 break-all font-mono text-[11px] text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  {challenge.problemUrl}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <div className="mt-3 border-t border-border/50 pt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Steps
                  </p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground marker:font-mono marker:text-primary">
                    <li>Open the assigned problem using the link above.</li>
                    <li>
                      Sign in as <span className="font-mono text-foreground">@{challenge.handle}</span>. {challenge.instruction}
                    </li>
                    <li>
                      Wait a few seconds for the submission to become public, return here, and choose <span className="font-medium text-foreground">Check submission</span>.
                    </li>
                  </ol>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/15 px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{privacyCopy}</p>
                </div>
              </div>

              {isExpired ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3" role="alert">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium">Challenge expired</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Start a fresh five-minute window before submitting again.
                    </p>
                  </div>
                </div>
              ) : submissionWindowClosed && notice?.kind !== "error" ? (
                <div
                  className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3.5 py-3"
                  role="status"
                  aria-live="polite"
                >
                  <Clock3 className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium">Submission window closed</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      If you submitted before 00:00, you can still check briefly while the platform publishes the result.
                    </p>
                  </div>
                </div>
              ) : notice ? (
                <div
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3.5 py-3",
                    notice.kind === "error"
                      ? "border-destructive/25 bg-destructive/5"
                      : "border-border/50 bg-muted/10",
                  )}
                  role={notice.kind === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {phase === "checking" ? (
                    <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                  ) : notice.kind === "error" ? (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                  ) : (
                    <Clock3 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{notice.text}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 flex-col border-t border-border/50 bg-card/95 p-4">
          {(phase === "idle" || phase === "starting") && (
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}

          {phase === "error" && !challenge && (
            <>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={retryChallenge} disabled={!handle.trim()}>
                <RefreshCw aria-hidden="true" />
                Try again
              </Button>
            </>
          )}

          {phase === "verified" && (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              <CheckCircle2 aria-hidden="true" />
              Done
            </Button>
          )}

          {challenge && phase !== "verified" && isExpired && (
            <Button type="button" onClick={retryChallenge}>
              <RefreshCw aria-hidden="true" />
              Start a new challenge
            </Button>
          )}

          {challenge && phase !== "verified" && !isExpired && (
            <>
              {!submissionWindowClosed && (
                <a
                  href={challenge.problemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
                >
                  <ExternalLink aria-hidden="true" />
                  Open challenge
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <Button
                type="button"
                onClick={() => void checkSubmission()}
                disabled={phase === "checking"}
                className="w-full sm:w-auto"
              >
                {phase === "checking" ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}
                {phase === "checking" ? "Checking…" : "Check submission"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
