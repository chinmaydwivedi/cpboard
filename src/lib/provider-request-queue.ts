import "server-only";

import { prisma } from "@/lib/prisma";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Claims a database-backed provider slot so separate serverless instances obey
 * one shared request cadence.
 */
export async function acquireProviderRequestSlot(args: {
  key: string;
  spacingMs: number;
  maxQueueWaitMs: number;
  queuedAt?: number;
}) {
  if (!/^[A-Z0-9:_-]{1,80}$/.test(args.key)) {
    throw new Error("Invalid provider queue key");
  }
  const spacingMs = Math.max(100, Math.min(args.spacingMs, 60_000));
  const maxQueueWaitMs = Math.max(500, Math.min(args.maxQueueWaitMs, 60_000));
  const queuedAt = args.queuedAt ?? Date.now();

  while (Date.now() - queuedAt <= maxQueueWaitMs) {
    const claimed = await prisma.$queryRaw<Array<{ nextAllowedAt: Date }>>`
      INSERT INTO "ProviderRequestLease" (
        "provider",
        "nextAllowedAt",
        "updatedAt"
      )
      VALUES (
        ${args.key},
        CURRENT_TIMESTAMP + (
          CAST(${spacingMs} AS double precision) * INTERVAL '1 millisecond'
        ),
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("provider") DO UPDATE
      SET
        "nextAllowedAt" = CURRENT_TIMESTAMP + (
          CAST(${spacingMs} AS double precision) * INTERVAL '1 millisecond'
        ),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "ProviderRequestLease"."nextAllowedAt" <= CURRENT_TIMESTAMP
      RETURNING "nextAllowedAt"
    `;
    if (claimed.length > 0) return;

    const rows = await prisma.$queryRaw<Array<{ waitMs: number }>>`
      SELECT GREATEST(
        0,
        CEIL(
          EXTRACT(EPOCH FROM ("nextAllowedAt" - CURRENT_TIMESTAMP)) * 1000
        )
      )::integer AS "waitMs"
      FROM "ProviderRequestLease"
      WHERE "provider" = ${args.key}
    `;
    const waitMs = Math.max(50, Math.min(rows[0]?.waitMs ?? 100, 2_500));
    if (Date.now() - queuedAt + waitMs > maxQueueWaitMs) break;
    await delay(waitMs);
  }

  throw new Error("Provider request queue timed out. Try again shortly.");
}
