import { Platform } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncUserPlatform } from "@/lib/platforms";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  CRON_SYNC_COOLDOWN_MS,
  PlatformProfileNotLinkedError,
  PlatformSyncLeaseError,
} from "@/lib/platform-sync-lease";
import { acquireJobLease } from "@/lib/job-lease";
import {
  verifyBearerSecret,
} from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const BACKGROUND_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1_000;
const JOB_LEASE_MS = 90_000;
const POLICIES = {
  CODEFORCES: { concurrency: 3 },
  LEETCODE: { concurrency: 4 },
  ATCODER: { concurrency: 1 },
  CODECHEF: { concurrency: 2 },
} satisfies Record<Platform, { concurrency: number }>;

type CronProfile = {
  userId: string;
  platform: Platform;
  handle: string;
  dueCount: number;
  oldestDueAt: Date;
};

type CronSyncResult = {
  success: boolean;
  skipped: boolean;
};

function parsePlatform(value: string | null): Platform | null {
  return value && Object.values(Platform).includes(value as Platform)
    ? (value as Platform)
    : null;
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
      oldestDueAt: null,
      remainingDue: null,
      durationMs: Date.now() - startedAt,
    });
  }

  const profiles = await prisma.$queryRaw<CronProfile[]>`
    SELECT
      profiles."userId",
      profiles."platform",
      profiles."handle",
      (COUNT(*) OVER())::integer AS "dueCount",
      MIN(
        COALESCE(
          leases."lastStartedAt",
          profiles."lastSynced",
          TIMESTAMP '1970-01-01'
        )
      ) OVER() AS "oldestDueAt"
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
    ORDER BY
      COALESCE(
        leases."lastStartedAt",
        profiles."lastSynced",
        TIMESTAMP '1970-01-01'
      ) ASC,
      profiles."id" ASC
    LIMIT ${policy.concurrency}
  `;

  async function syncProfile(profile: CronProfile): Promise<CronSyncResult> {
    try {
      await syncUserPlatform(profile.userId, profile.platform, profile.handle, {
        minIntervalMs: CRON_SYNC_COOLDOWN_MS,
      });
      return { success: true, skipped: false };
    } catch (error) {
      const skipped =
        error instanceof PlatformSyncLeaseError ||
        error instanceof PlatformProfileNotLinkedError;
      if (!skipped) {
        console.warn(
          `Background ${platform} sync failed`,
          error instanceof Error ? error.name : "Unknown",
        );
      }
      return { success: false, skipped };
    }
  }

  const settled = await Promise.allSettled(profiles.map(syncProfile));
  const results = settled.map<CronSyncResult>((result) =>
    result.status === "fulfilled"
      ? result.value
      : { success: false, skipped: false },
  );
  const successful = results.filter((result) => result.success).length;
  const skipped = results.filter((result) => result.skipped).length;
  const failed = results.length - successful - skipped;
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
    oldestDueAt: profiles[0]?.oldestDueAt?.toISOString() ?? null,
    remainingDue: Math.max(0, dueCount - results.length),
    durationMs: Date.now() - startedAt,
  });
}
