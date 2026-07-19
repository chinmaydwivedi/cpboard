import { NextRequest, NextResponse } from "next/server";
import { acquireJobLease, extendJobLease } from "@/lib/job-lease";
import { prisma } from "@/lib/prisma";
import { isTrustedPushEndpoint } from "@/lib/push-endpoint";
import {
  cleanupExpiredSecurityState,
  verifyBearerSecret,
} from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const HOUSEKEEPING_LEASE_MS = 20 * 60 * 60 * 1_000;
const HOUSEKEEPING_RUN_LEASE_MS = 10 * 60 * 1_000;

async function removeUntrustedPushSubscriptions() {
  const subscriptions = await prisma.pushSubscription.findMany({
    select: { id: true, endpoint: true },
    take: 10_000,
  });
  const ids = subscriptions
    .filter((subscription) => !isTrustedPushEndpoint(subscription.endpoint))
    .map((subscription) => subscription.id);
  if (ids.length === 0) return { count: 0 };
  return prisma.pushSubscription.deleteMany({ where: { id: { in: ids } } });
}

async function runtimeDatabaseRoleIsRestricted() {
  const [security] = await prisma.$queryRaw<
    Array<{
      isDatabaseOwner: boolean;
      canCreateSchemaObjects: boolean;
      canCreateDatabaseObjects: boolean;
    }>
  >`
    SELECT
      CURRENT_USER = pg_get_userbyid(databases.datdba) AS "isDatabaseOwner",
      has_schema_privilege(CURRENT_USER, 'public', 'CREATE')
        AS "canCreateSchemaObjects",
      has_database_privilege(CURRENT_USER, CURRENT_DATABASE(), 'CREATE')
        AS "canCreateDatabaseObjects"
    FROM pg_database AS databases
    WHERE databases.datname = CURRENT_DATABASE()
  `;
  return Boolean(
    security &&
      !security.isDatabaseOwner &&
      !security.canCreateSchemaObjects &&
      !security.canCreateDatabaseObjects,
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (
    !verifyBearerSecret(
      request.headers.get("authorization"),
      process.env.PLATFORM_SYNC_CRON_SECRET,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseRoleRestricted = await runtimeDatabaseRoleIsRestricted();
  if (!databaseRoleRestricted) {
    console.error("Runtime database role has elevated privileges");
    return NextResponse.json(
      { error: "Runtime database security check failed" },
      { status: 503 },
    );
  }

  if (!(await acquireJobLease("daily-housekeeping", HOUSEKEEPING_RUN_LEASE_MS))) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "not_due",
      databaseRoleRestricted,
      durationMs: Date.now() - startedAt,
    });
  }

  const now = Date.now();
  const subscriptions = await removeUntrustedPushSubscriptions();
  const [
    challenges,
    syncLogs,
    deliveries,
    visits,
    sessions,
    tokens,
    limits,
  ] =
    await Promise.all([
      prisma.platformVerificationChallenge.deleteMany({
        where: {
          verifiedAt: null,
          expiresAt: { lt: new Date(now - 24 * 60 * 60 * 1_000) },
        },
      }),
      prisma.syncLog.deleteMany({
        where: { syncedAt: { lt: new Date(now - 90 * 24 * 60 * 60 * 1_000) } },
      }),
      prisma.notificationDelivery.deleteMany({
        where: { createdAt: { lt: new Date(now - 90 * 24 * 60 * 60 * 1_000) } },
      }),
      prisma.pageVisit.deleteMany({
        where: { createdAt: { lt: new Date(now - 365 * 24 * 60 * 60 * 1_000) } },
      }),
      prisma.session.deleteMany({ where: { expires: { lt: new Date(now) } } }),
      prisma.verificationToken.deleteMany({
        where: { expires: { lt: new Date(now) } },
      }),
      cleanupExpiredSecurityState(),
    ]);
  await extendJobLease("daily-housekeeping", HOUSEKEEPING_LEASE_MS);

  return NextResponse.json({
    success: true,
    skipped: false,
    databaseRoleRestricted,
    deleted: {
      verificationChallenges: challenges.count,
      syncLogs: syncLogs.count,
      notificationDeliveries: deliveries.count,
      pageVisits: visits.count,
      sessions: sessions.count,
      verificationTokens: tokens.count,
      rateLimitBuckets: limits.count,
      untrustedPushSubscriptions: subscriptions.count,
    },
    durationMs: Date.now() - startedAt,
  });
}
