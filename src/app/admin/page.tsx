import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasAdminAccess } from "@/lib/admin";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
  let session;
  try {
    session = await getCurrentSession();
  } catch {
    redirect("/login");
  }

  if (!session?.user?.email) redirect("/login");

  const canAccessAdmin = await hasAdminAccess(session.user.email);
  if (!canAccessAdmin) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You need admin privileges to access this page.
        </p>
      </div>
    );
  }

  const dbNowRows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
  const dbNow = dbNowRows[0]?.now;
  if (!dbNow) {
    throw new Error("Failed to resolve current timestamp");
  }

  const oneDayAgo = new Date(dbNow.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(dbNow.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    universities,
    userCount,
    syncStats,
    siteVisitCount,
    siteVisitCount24h,
    uniqueVisitors30dRows,
    topPagesRaw,
    topVisitors,
    totalProfileViews,
  ] = await Promise.all([
    prisma.university.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.count(),
    prisma.syncLog.groupBy({
      by: ["status"],
      _count: { status: true },
      where: {
        syncedAt: { gte: oneDayAgo },
      },
    }),
    prisma.pageVisit.count(),
    prisma.pageVisit.count({
      where: { createdAt: { gte: oneDayAgo } },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT "visitorId")::integer AS "count"
      FROM "PageVisit"
      WHERE "createdAt" >= ${thirtyDaysAgo}
    `,
    prisma.pageVisit.groupBy({
      by: ["path"],
      _count: { path: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),
    // Aggregate in SQL so the ranking covers every visit in the window.
    prisma.$queryRaw<
      Array<{
        userId: string;
        username: string;
        name: string | null;
        visits: number;
        mostVisitedPath: string;
        mostVisitedCount: number;
      }>
    >`
      WITH top_visitors AS (
        SELECT "viewerUserId", COUNT(*)::integer AS "visits"
        FROM "PageVisit"
        WHERE "createdAt" >= ${thirtyDaysAgo}
          AND "viewerUserId" IS NOT NULL
        GROUP BY "viewerUserId"
        ORDER BY "visits" DESC, "viewerUserId"
        LIMIT 10
      ),
      top_paths AS (
        SELECT DISTINCT ON (visits."viewerUserId")
          visits."viewerUserId",
          visits."path",
          COUNT(*)::integer AS "pathVisits"
        FROM "PageVisit" AS visits
        INNER JOIN top_visitors
          ON top_visitors."viewerUserId" = visits."viewerUserId"
        WHERE visits."createdAt" >= ${thirtyDaysAgo}
        GROUP BY visits."viewerUserId", visits."path"
        ORDER BY visits."viewerUserId", "pathVisits" DESC, visits."path"
      )
      SELECT
        users."id" AS "userId",
        users."username",
        users."name",
        top_visitors."visits",
        top_paths."path" AS "mostVisitedPath",
        top_paths."pathVisits" AS "mostVisitedCount"
      FROM top_visitors
      INNER JOIN "User" AS users ON users."id" = top_visitors."viewerUserId"
      INNER JOIN top_paths
        ON top_paths."viewerUserId" = top_visitors."viewerUserId"
      ORDER BY top_visitors."visits" DESC, top_visitors."viewerUserId"
    `,
    prisma.user.aggregate({
      _sum: { profileViews: true },
    }),
  ]);

  return (
    <AdminClient
      universities={universities.map((u) => ({
        id: u.id,
        name: u.name,
        shortName: u.shortName,
        emailDomain: u.emailDomain,
        logoUrl: u.logoUrl,
        userCount: u._count.users,
      }))}
      totalUsers={userCount}
      syncStats={{
        success: syncStats.find((s) => s.status === "SUCCESS")?._count.status || 0,
        failed: syncStats.find((s) => s.status === "FAILED")?._count.status || 0,
      }}
      analytics={{
        siteVisits: siteVisitCount,
        siteVisits24h: siteVisitCount24h,
        uniqueVisitors30d: uniqueVisitors30dRows[0]?.count ?? 0,
        totalProfileVisits: totalProfileViews._sum.profileViews ?? 0,
        topPages: topPagesRaw.map((page) => ({
          path: page.path,
          visits: page._count.path,
        })),
        topVisitors,
      }}
    />
  );
}
