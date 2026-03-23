import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }

  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You need admin privileges to access this page.
        </p>
      </div>
    );
  }

  const [universities, userCount, syncStats] = await Promise.all([
    prisma.university.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.count(),
    prisma.syncLog.groupBy({
      by: ["status"],
      _count: { status: true },
      where: {
        syncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
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
    />
  );
}
