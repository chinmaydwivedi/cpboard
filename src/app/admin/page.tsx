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
    recentLoggedInVisits,
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
    prisma.pageVisit.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        viewerUserId: { not: null },
      },
      select: { viewerUserId: true, path: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.user.aggregate({
      _sum: { profileViews: true },
    }),
  ]);

  const visitsByUser = new Map<
    string,
    { total: number; pageBreakdown: Map<string, number> }
  >();

  for (const visit of recentLoggedInVisits) {
    if (!visit.viewerUserId) continue;
    const existing = visitsByUser.get(visit.viewerUserId) ?? {
      total: 0,
      pageBreakdown: new Map<string, number>(),
    };
    existing.total += 1;
    existing.pageBreakdown.set(
      visit.path,
      (existing.pageBreakdown.get(visit.path) ?? 0) + 1
    );
    visitsByUser.set(visit.viewerUserId, existing);
  }

  const topVisitorIds = [...visitsByUser.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([userId]) => userId);

  const visitorUsers = topVisitorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topVisitorIds } },
        select: { id: true, username: true, name: true },
      })
    : [];
  const visitorUsersById = new Map(visitorUsers.map((u) => [u.id, u]));

  const topVisitors = topVisitorIds
    .map((userId) => {
      const counts = visitsByUser.get(userId);
      const user = visitorUsersById.get(userId);
      if (!counts || !user) return null;

      let mostVisitedPath = "/";
      let mostVisitedCount = 0;
      for (const [path, count] of counts.pageBreakdown) {
        if (count > mostVisitedCount) {
          mostVisitedPath = path;
          mostVisitedCount = count;
        }
      }

      return {
        userId,
        username: user.username,
        name: user.name,
        visits: counts.total,
        mostVisitedPath,
        mostVisitedCount,
      };
    })
    .filter(
      (
        visitor
      ): visitor is {
        userId: string;
        username: string;
        name: string | null;
        visits: number;
        mostVisitedPath: string;
        mostVisitedCount: number;
      } => visitor !== null
    );

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
