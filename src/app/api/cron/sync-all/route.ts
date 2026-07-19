import { Platform } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncUserPlatform } from "@/lib/platforms";
import {
  PROVIDER_PROFILE_NOT_FOUND_MESSAGE,
  ProviderProfileNotFoundError,
} from "@/lib/platforms/errors";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  CRON_SYNC_COOLDOWN_MS,
  PlatformProfileNotLinkedError,
  PlatformSyncLeaseError,
} from "@/lib/platform-sync-lease";
import { acquireJobLease } from "@/lib/job-lease";
import { verifyBearerSecret } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const BACKGROUND_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1_000;
const JOB_LEASE_MS = 90_000;
const ROUTE_SAFETY_MARGIN_MS = 8_000;
const POLICIES = {
  CODEFORCES: { concurrency: 3, maxBatchSize: 9, profileBudgetMs: 38_000 },
  LEETCODE: { concurrency: 4, maxBatchSize: 24, profileBudgetMs: 16_000 },
  ATCODER: { concurrency: 1, maxBatchSize: 4, profileBudgetMs: 42_000 },
  CODECHEF: { concurrency: 2, maxBatchSize: 12, profileBudgetMs: 26_000 },
} satisfies Record<
  Platform,
  { concurrency: number; maxBatchSize: number; profileBudgetMs: number }
>;

type CronFailureClass = "transient" | "transport" | "malformed";

type CronProfile = {
  userId: string;
  platform: Platform;
  handle: string;
  dueCount: number;
  oldestDueAt: Date;
  consecutiveFailures: number;
};

type CronSyncResult = {
  success: boolean;
  skipped: boolean;
  failureClass: CronFailureClass | null;
  failureStreak: number;
};

function parsePlatform(value: string | null): Platform | null {
  return value && Object.values(Platform).includes(value as Platform)
    ? (value as Platform)
    : null;
}

function classifySyncFailure(error: unknown): CronFailureClass {
  const errorName = error instanceof Error ? error.name.toLowerCase() : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    errorName === "syntaxerror" ||
    message.includes("invalid data") ||
    message.includes("invalid response") ||
    message.includes("unexpected token")
  ) {
    return "malformed";
  }

  if (
    errorName === "timeouterror" ||
    errorName === "aborterror" ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("fetch failed") ||
    message.includes("api failed") ||
    message.includes("failed (") ||
    message.includes("queue is busy") ||
    message.includes("try again shortly")
  ) {
    return "transport";
  }

  return "transient";
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  if (
    !verifyBearerSecret(
      req.headers.get("authorization"),
      process.env.PLATFORM_SYNC_CRON_SECRET,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = parsePlatform(req.nextUrl.searchParams.get("platform"));
  if (!platform) {
    return NextResponse.json({ error: "Valid platform is required" }, { status: 400 });
  }
  const policy = POLICIES[platform];

  if (!(await acquireJobLease(`platform-sync:${platform}`, JOB_LEASE_MS))) {
    return NextResponse.json({
      platform,
      jobSkipped: true,
      reason: "already_running",
      selected: 0,
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      deferred: 0,
      failureSummary: {
        transient: 0,
        transport: 0,
        malformed: 0,
        sustained: 0,
        maxConsecutiveFailures: 0,
      },
      oldestDueAt: null,
      remainingDue: null,
      durationMs: Date.now() - startedAt,
    });
  }

  const profiles = await prisma.$queryRaw<CronProfile[]>`
    WITH due_profiles AS (
      SELECT
        profiles."id" AS "profileId",
        profiles."userId",
        profiles."platform",
        profiles."handle",
        (COUNT(*) OVER())::integer AS "dueCount",
        COALESCE(leases."consecutiveFailures", 0)::integer
          AS "consecutiveFailures",
        MIN(
          COALESCE(
            leases."lastStartedAt",
            profiles."lastSynced",
            TIMESTAMP '1970-01-01'
          )
        ) OVER() AS "oldestDueAt",
        COALESCE(
          leases."lastStartedAt",
          profiles."lastSynced",
          TIMESTAMP '1970-01-01'
        ) AS "lastDueAt",
        leases."nextAttemptAt",
        (
          COALESCE(leases."consecutiveFailures", 0) > 0
          AND leases."lastError" IS DISTINCT FROM
            ${PROVIDER_PROFILE_NOT_FOUND_MESSAGE}
        ) AS "retryCandidate"
      FROM "PlatformProfile" AS profiles
      INNER JOIN "User" AS users
        ON users."id" = profiles."userId"
      LEFT JOIN "PlatformSyncLease" AS leases
        ON leases."userId" = profiles."userId"
        AND leases."platform" = profiles."platform"
      WHERE profiles."verified" = true
        AND profiles."platform" = CAST(${platform} AS "Platform")
        AND users."onboardingComplete" = true
        AND (
          leases."leaseUntil" IS NULL
          OR leases."leaseUntil" <= CURRENT_TIMESTAMP
        )
        AND (
          (
            COALESCE(leases."consecutiveFailures", 0) = 0
            AND COALESCE(
              leases."lastStartedAt",
              profiles."lastSynced",
              TIMESTAMP '1970-01-01'
            ) <= CURRENT_TIMESTAMP - (
              CAST(${BACKGROUND_SYNC_INTERVAL_MS} AS double precision)
              * INTERVAL '1 millisecond'
            )
          )
          OR (
            COALESCE(leases."consecutiveFailures", 0) > 0
            AND leases."nextAttemptAt" <= CURRENT_TIMESTAMP
            AND leases."lastStartedAt" <= CURRENT_TIMESTAMP - (
              CAST(${CRON_SYNC_COOLDOWN_MS} AS double precision)
              * INTERVAL '1 millisecond'
            )
          )
        )
    ),
    ranked_profiles AS (
      SELECT
        due_profiles.*,
        CASE
          WHEN "retryCandidate" THEN ROW_NUMBER() OVER (
            PARTITION BY "retryCandidate"
            ORDER BY "nextAttemptAt" ASC, "profileId" ASC
          )
          ELSE NULL
        END AS "retryRank"
      FROM due_profiles
    )
    SELECT
      "userId",
      "platform",
      "handle",
      "dueCount",
      "oldestDueAt",
      "consecutiveFailures"
    FROM ranked_profiles
    ORDER BY
      CASE
        WHEN "retryCandidate" AND "retryRank" <= ${policy.concurrency} THEN 0
        ELSE 1
      END ASC,
      CASE
        WHEN "retryCandidate" AND "retryRank" <= ${policy.concurrency}
          THEN "nextAttemptAt"
        ELSE "lastDueAt"
      END ASC,
      "profileId" ASC
    LIMIT ${policy.maxBatchSize}
  `;

  async function syncProfile(profile: CronProfile): Promise<CronSyncResult> {
    try {
      await syncUserPlatform(profile.userId, profile.platform, profile.handle, {
        minIntervalMs: CRON_SYNC_COOLDOWN_MS,
        providerDeadlineAt: Math.min(
          startedAt + maxDuration * 1_000 - ROUTE_SAFETY_MARGIN_MS,
          Date.now() + policy.profileBudgetMs,
        ),
      });
      return {
        success: true,
        skipped: false,
        failureClass: null,
        failureStreak: 0,
      };
    } catch (error) {
      const skipped =
        error instanceof PlatformSyncLeaseError ||
        error instanceof PlatformProfileNotLinkedError ||
        error instanceof ProviderProfileNotFoundError;
      if (!skipped) {
        // Keep logs useful without formatting or writing provider-controlled
        // values into the log stream.
        console.warn("A background provider sync failed");
      }
      return {
        success: false,
        skipped,
        failureClass: skipped ? null : classifySyncFailure(error),
        failureStreak: skipped ? 0 : profile.consecutiveFailures + 1,
      };
    }
  }

  // GitHub schedules may arrive late. Drain more than one wave when providers
  // are responsive, but stop starting work early enough for an in-flight
  // profile to finish before the platform's 60 second route limit.
  const latestProfileStartAt =
    startedAt +
    maxDuration * 1_000 -
    ROUTE_SAFETY_MARGIN_MS -
    policy.profileBudgetMs;
  let nextProfileIndex = 0;
  const results: CronSyncResult[] = [];

  async function runWorker() {
    while (Date.now() <= latestProfileStartAt) {
      const profileIndex = nextProfileIndex;
      nextProfileIndex += 1;
      const profile = profiles[profileIndex];
      if (!profile) return;
      results.push(await syncProfile(profile));
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(policy.concurrency, profiles.length) },
      () => runWorker(),
    ),
  );
  const successful = results.filter((result) => result.success).length;
  const skipped = results.filter((result) => result.skipped).length;
  const failed = results.length - successful - skipped;
  const failures = results.filter(
    (result) => !result.success && !result.skipped,
  );
  const failureSummary = {
    transient: failures.filter(
      (result) => result.failureClass === "transient",
    ).length,
    transport: failures.filter(
      (result) => result.failureClass === "transport",
    ).length,
    malformed: failures.filter(
      (result) => result.failureClass === "malformed",
    ).length,
    sustained: failures.filter((result) => result.failureStreak >= 2).length,
    maxConsecutiveFailures: failures.reduce(
      (highest, result) => Math.max(highest, result.failureStreak),
      0,
    ),
  };
  if (successful > 0) {
    revalidateTag(CACHE_TAGS.leaderboard, "max");
    if (platform === "CODEFORCES") {
      revalidateTag(CACHE_TAGS.cpRankings, "max");
    }
  }

  const dueCount = profiles[0]?.dueCount ?? 0;
  return NextResponse.json({
    platform,
    selected: profiles.length,
    attempted: results.length,
    successful,
    failed,
    skipped,
    deferred: Math.max(0, profiles.length - results.length),
    failureSummary,
    oldestDueAt: profiles[0]?.oldestDueAt?.toISOString() ?? null,
    remainingDue: Math.max(0, dueCount - results.length),
    durationMs: Date.now() - startedAt,
  });
}
