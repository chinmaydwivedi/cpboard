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

export const maxDuration = 60;

const BATCH_SIZE = 3;
const CANDIDATE_LIMIT = 24;
const TIME_BUDGET_MS = 55_000;
// The slowest provider path can consume roughly 40 seconds including its
// distributed queue wait. Do not start a later batch unless that much budget
// remains; the first batch is always allowed so each run still makes progress.
const BATCH_RUNTIME_RESERVE_MS = 42_000;

type CronProfile = {
  userId: string;
  platform: Platform;
  handle: string;
};

type CronSyncResult = {
  userId: string;
  platform: Platform;
  success: boolean;
  skipped?: boolean;
  error?: string;
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await acquireJobLease("platform-sync", 60_000))) {
    return NextResponse.json({ skipped: true, reason: "already_running" });
  }

  const startTime = Date.now();
  const [profiles] = await Promise.all([
    prisma.$queryRaw<CronProfile[]>`
      SELECT
        profiles."userId",
        profiles."platform",
        profiles."handle"
      FROM "PlatformProfile" AS profiles
      INNER JOIN "User" AS users
        ON users."id" = profiles."userId"
      LEFT JOIN "PlatformSyncLease" AS leases
        ON leases."userId" = profiles."userId"
        AND leases."platform" = profiles."platform"
      WHERE profiles."verified" = true
        AND users."onboardingComplete" = true
        AND (
          leases."leaseUntil" IS NULL
          OR leases."leaseUntil" <= CURRENT_TIMESTAMP
        )
        AND (
          leases."nextAttemptAt" IS NULL
          OR leases."nextAttemptAt" <= CURRENT_TIMESTAMP
        )
        AND (
          leases."lastStartedAt" IS NULL
          OR leases."lastStartedAt" <= CURRENT_TIMESTAMP - (
            CAST(${CRON_SYNC_COOLDOWN_MS} AS double precision)
            * INTERVAL '1 millisecond'
          )
        )
      ORDER BY
        COALESCE(
          leases."lastStartedAt",
          profiles."lastSynced",
          '-infinity'::timestamp
        ) ASC,
        profiles."id" ASC
      LIMIT ${CANDIDATE_LIMIT}
    `,
    prisma.platformVerificationChallenge.deleteMany({
      where: {
        verifiedAt: null,
        expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1_000) },
      },
    }),
  ]);

  const results: CronSyncResult[] = [];
  let timedOut = false;

  async function syncProfile(profile: CronProfile): Promise<CronSyncResult> {
    try {
      await syncUserPlatform(profile.userId, profile.platform, profile.handle, {
        minIntervalMs: CRON_SYNC_COOLDOWN_MS,
      });
      return {
        userId: profile.userId,
        platform: profile.platform,
        success: true,
      };
    } catch (error) {
      const skipped =
        error instanceof PlatformSyncLeaseError ||
        error instanceof PlatformProfileNotLinkedError;
      return {
        userId: profile.userId,
        platform: profile.platform,
        success: false,
        skipped,
        error: error instanceof Error ? error.message : "Unknown",
      };
    }
  }

  for (let index = 0; index < profiles.length; index += BATCH_SIZE) {
    const elapsedMs = Date.now() - startTime;
    if (
      elapsedMs > TIME_BUDGET_MS ||
      (index > 0 && TIME_BUDGET_MS - elapsedMs < BATCH_RUNTIME_RESERVE_MS)
    ) {
      timedOut = true;
      break;
    }
    const batch = profiles.slice(index, index + BATCH_SIZE);
    results.push(...(await Promise.all(batch.map(syncProfile))));
  }

  const successfulResults = results.filter((result) => result.success);
  if (successfulResults.length > 0) {
    revalidateTag(CACHE_TAGS.landingStats, "max");
    revalidateTag(CACHE_TAGS.leaderboard, "max");
    if (
      successfulResults.some(
        (result) =>
          result.platform === "CODEFORCES" || result.platform === "LEETCODE",
      )
    ) {
      revalidateTag(CACHE_TAGS.topicRadar, "max");
    }
    if (successfulResults.some((result) => result.platform === "CODEFORCES")) {
      revalidateTag(CACHE_TAGS.cpRankings, "max");
    }
  }

  return NextResponse.json({
    selected: profiles.length,
    attempted: results.length,
    successful: successfulResults.length,
    failed: results.filter((result) => !result.success && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    timedOut,
    results,
  });
}
