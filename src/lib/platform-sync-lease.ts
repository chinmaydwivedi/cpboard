import "server-only";

import { randomUUID } from "node:crypto";
import type { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const USER_SYNC_COOLDOWN_MS = 30 * 60 * 1_000;
export const CRON_SYNC_COOLDOWN_MS = 10 * 60 * 1_000;

const SYNC_LEASE_DURATION_MS = 90 * 1_000;
const FAILURE_BACKOFF_BASE_MS = 30 * 60 * 1_000;
const FAILURE_BACKOFF_MAX_MS = 24 * 60 * 60 * 1_000;

export class PlatformSyncLeaseError extends Error {
  constructor(
    message: string,
    readonly code: "SYNC_BUSY" | "SYNC_COOLDOWN" | "SYNC_BACKOFF",
    readonly retryAfter: number,
  ) {
    super(message);
    this.name = "PlatformSyncLeaseError";
  }
}

export class PlatformProfileNotLinkedError extends Error {
  constructor() {
    super("This platform profile is no longer linked");
    this.name = "PlatformProfileNotLinkedError";
  }
}

type PlatformSyncLease = {
  userId: string;
  platform: Platform;
  leaseToken: string;
};

function secondsUntil(value: Date, now = Date.now()) {
  return Math.max(1, Math.ceil((value.getTime() - now) / 1_000));
}

export async function acquirePlatformSyncLease(args: {
  userId: string;
  platform: Platform;
  minIntervalMs?: number;
}): Promise<PlatformSyncLease> {
  const leaseToken = randomUUID();
  const minIntervalMs = Math.max(0, args.minIntervalMs ?? USER_SYNC_COOLDOWN_MS);
  const acquired = await prisma.$queryRaw<Array<{ leaseToken: string }>>`
    INSERT INTO "PlatformSyncLease" (
      "userId",
      "platform",
      "leaseToken",
      "leaseUntil",
      "lastStartedAt",
      "nextAttemptAt",
      "consecutiveFailures",
      "updatedAt"
    )
    VALUES (
      ${args.userId},
      CAST(${args.platform} AS "Platform"),
      ${leaseToken},
      CURRENT_TIMESTAMP + (
        CAST(${SYNC_LEASE_DURATION_MS} AS double precision)
        * INTERVAL '1 millisecond'
      ),
      CURRENT_TIMESTAMP,
      NULL,
      0,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "platform") DO UPDATE
      SET
        "leaseToken" = EXCLUDED."leaseToken",
        "leaseUntil" = EXCLUDED."leaseUntil",
        "lastStartedAt" = EXCLUDED."lastStartedAt",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "PlatformSyncLease"."leaseUntil" <= CURRENT_TIMESTAMP
        AND (
          "PlatformSyncLease"."nextAttemptAt" IS NULL
          OR "PlatformSyncLease"."nextAttemptAt" <= CURRENT_TIMESTAMP
        )
        AND "PlatformSyncLease"."lastStartedAt" <= CURRENT_TIMESTAMP - (
          CAST(${minIntervalMs} AS double precision)
          * INTERVAL '1 millisecond'
        )
    RETURNING "leaseToken"
  `;

  if (acquired.length > 0) {
    return { userId: args.userId, platform: args.platform, leaseToken };
  }

  const existing = await prisma.platformSyncLease.findUnique({
    where: {
      userId_platform: { userId: args.userId, platform: args.platform },
    },
    select: { leaseUntil: true, lastStartedAt: true, nextAttemptAt: true },
  });
  const now = Date.now();
  if (existing?.leaseUntil && existing.leaseUntil.getTime() > now) {
    throw new PlatformSyncLeaseError(
      "A sync for this platform is already running",
      "SYNC_BUSY",
      secondsUntil(existing.leaseUntil, now),
    );
  }
  if (existing?.nextAttemptAt && existing.nextAttemptAt.getTime() > now) {
    throw new PlatformSyncLeaseError(
      "The provider is recovering from a failed sync. Try again shortly.",
      "SYNC_BACKOFF",
      secondsUntil(existing.nextAttemptAt, now),
    );
  }
  const cooldownUntil = existing
    ? new Date(existing.lastStartedAt.getTime() + minIntervalMs)
    : new Date(now + Math.max(1_000, minIntervalMs));
  throw new PlatformSyncLeaseError(
    "Please wait before syncing this platform again",
    "SYNC_COOLDOWN",
    secondsUntil(cooldownUntil, now),
  );
}

export async function completePlatformSyncLease(
  lease: PlatformSyncLease,
  result: { success: true } | { success: false; error: string },
) {
  if (result.success) {
    await prisma.platformSyncLease.updateMany({
      where: {
        userId: lease.userId,
        platform: lease.platform,
        leaseToken: lease.leaseToken,
      },
      data: {
        leaseUntil: new Date(),
        nextAttemptAt: null,
        consecutiveFailures: 0,
        lastError: null,
      },
    });
    return;
  }

  await prisma.$executeRaw`
    UPDATE "PlatformSyncLease"
    SET
      "leaseUntil" = CURRENT_TIMESTAMP,
      "nextAttemptAt" = CURRENT_TIMESTAMP + (
        LEAST(
          CAST(${FAILURE_BACKOFF_MAX_MS} AS double precision),
          CAST(${FAILURE_BACKOFF_BASE_MS} AS double precision)
            * POWER(2, LEAST("consecutiveFailures", 10))
        ) * INTERVAL '1 millisecond'
      ),
      "consecutiveFailures" = "consecutiveFailures" + 1,
      "lastError" = ${result.error.slice(0, 500)},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${lease.userId}
      AND "platform" = CAST(${lease.platform} AS "Platform")
      AND "leaseToken" = ${lease.leaseToken}
  `;
}

export async function lockPlatformProfileTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  platform: Platform,
) {
  const lockKey = `${userId}:${platform}`;
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
  `;
}
