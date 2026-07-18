import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Claims a short, crash-safe lease for a scheduled job. The shared database
 * makes the guard effective across Vercel instances; expiry allows recovery
 * when an invocation is terminated before it finishes.
 */
export async function acquireJobLease(key: string, durationMs: number) {
  const safeDurationMs = Math.max(1_000, Math.min(durationMs, 15 * 60_000));
  const rows = await prisma.$queryRaw<Array<{ provider: string }>>`
    INSERT INTO "ProviderRequestLease" (
      "provider",
      "nextAllowedAt",
      "updatedAt"
    )
    VALUES (
      ${`JOB:${key}`},
      CURRENT_TIMESTAMP + (
        CAST(${safeDurationMs} AS double precision) * INTERVAL '1 millisecond'
      ),
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("provider") DO UPDATE
    SET
      "nextAllowedAt" = EXCLUDED."nextAllowedAt",
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "ProviderRequestLease"."nextAllowedAt" <= CURRENT_TIMESTAMP
    RETURNING "provider"
  `;
  return rows.length === 1;
}
